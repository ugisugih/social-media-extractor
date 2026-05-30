import { Injectable } from '@nestjs/common';
import { PipelineResult, MediaType, DownloadedMedia } from './types';
import { MetadataExtractorService } from './metadata-extractor.service';
import { PlatformDetectorService } from './platform-detector.service';
import { MediaTypeDetectorService } from './media-type-detector.service';
import { ImageHandler } from './handlers/image.handler';
import { VideoHandler } from './handlers/video.handler';
import { CarouselHandler } from './handlers/carousel.handler';
import { ResponseBuilderService } from './response-builder.service';
import { LoggerService } from './logger.service';
import { ProcessRequest } from './types';

@Injectable()
export class PipelineService {
  constructor(
    private readonly metadataExtractor: MetadataExtractorService,
    private readonly platformDetector: PlatformDetectorService,
    private readonly mediaTypeDetector: MediaTypeDetectorService,
    private readonly imageHandler: ImageHandler,
    private readonly videoHandler: VideoHandler,
    private readonly carouselHandler: CarouselHandler,
    private readonly responseBuilder: ResponseBuilderService,
    private readonly logger: LoggerService,
  ) {}

  async process(request: ProcessRequest): Promise<PipelineResult> {
    const startTime = Date.now();
    this.logger.log('Pipeline processing started', { url: request.url });

    try {
      // Step 1: Detect platform
      this.logger.log('Step 1: Detecting platform', { url: request.url });
      const platform = this.platformDetector.detect(request.url);

      if (!this.platformDetector.isSupported(platform)) {
        this.logger.warn('Unsupported platform detected', {
          platform,
          url: request.url,
        });
        return this.responseBuilder.buildError(
          new Error(`Unsupported platform: ${platform}`),
          request.url,
        );
      }

      this.logger.log('Platform detected', { platform });

      // Step 2: Extract metadata
      this.logger.log('Step 2: Extracting metadata', { url: request.url });
      const metadata = await this.metadataExtractor.extract(request.url);

      // Step 3: Detect media type
      this.logger.log('Step 3: Detecting media type');
      const mediaType = this.mediaTypeDetector.detect(metadata);
      metadata.mediaType = mediaType;
      metadata.platform = platform;

      this.logger.log('Media type detected', { mediaType });

      // Step 4 & 5: Route to handler and download
      this.logger.log('Step 4: Routing to handler', { mediaType });
      const downloadedMedia = await this.routeToHandler(
        request.url,
        mediaType,
        metadata,
      );

      // Step 6: Build response
      this.logger.log('Step 6: Building response');
      const result = this.responseBuilder.buildSuccess(metadata, downloadedMedia);

      const duration = Date.now() - startTime;
      this.logger.log('Pipeline processing completed', {
        duration: `${duration}ms`,
        mediaCount: downloadedMedia.length,
        platform,
        mediaType,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Pipeline processing failed', error.message, {
        duration: `${duration}ms`,
        url: request.url,
      });

      return this.responseBuilder.buildError(error, request.url);
    }
  }

  private async routeToHandler(
    url: string,
    mediaType: MediaType,
    metadata: any,
  ) {
    switch (mediaType) {
      case MediaType.IMAGE:
        return this.imageHandler.download(url, metadata);

      case MediaType.VIDEO:
        return this.videoHandler.download(url, metadata);

      case MediaType.CAROUSEL:
        return this.carouselHandler.download(url, metadata);

      case MediaType.MIXED_MEDIA:
        return this.handleMixedMedia(url, metadata);

      default:
        this.logger.warn('Unknown media type, defaulting to video handler');
        return this.videoHandler.download(url, metadata);
    }
  }

  private async handleMixedMedia(url: string, metadata: any) {
    this.logger.log('Processing mixed media content');

    if (metadata.entries && metadata.entries.length > 0) {
      const allMedia: DownloadedMedia[] = [];
      for (const entry of metadata.entries) {
        const entryMediaType = this.mediaTypeDetector.detect(entry);
        const media = await this.routeToHandler(
          entry.url || url,
          entryMediaType,
          entry,
        );
        allMedia.push(...media);
      }
      return allMedia;
    }

    return this.videoHandler.download(url, metadata);
  }
}
