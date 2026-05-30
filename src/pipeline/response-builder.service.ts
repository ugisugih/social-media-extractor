import { Injectable } from '@nestjs/common';
import { PipelineResult, MediaMetadata, DownloadedMedia } from './types';
import { LoggerService } from './logger.service';

@Injectable()
export class ResponseBuilderService {
  constructor(private readonly logger: LoggerService) {}

  buildSuccess(
    metadata: MediaMetadata,
    downloadedMedia: DownloadedMedia[],
  ): PipelineResult {
    this.logger.log('Building response', {
      mediaCount: downloadedMedia.length,
    });

    const hasMedia = downloadedMedia.length > 0;

    return {
      success: hasMedia,
      platform: metadata.platform,
      mediaType: metadata.mediaType,
      title: metadata.title,
      caption: metadata.caption,
      description: hasMedia ? metadata.description : 'No media could be downloaded',
      thumbnail: metadata.thumbnail,
      uploader: metadata.uploader,
      channel: metadata.channel,
      author: metadata.author,
      uploadDate: metadata.uploadDate,
      duration: metadata.duration,
      media: downloadedMedia,
      rawMetadata: metadata.rawMetadata,
    };
  }

  buildError(error: Error, url: string): PipelineResult {
    this.logger.error('Building error response', error.message, { url });

    return {
      success: false,
      platform: 'unknown',
      mediaType: 'unknown',
      title: undefined,
      caption: undefined,
      description: error.message,
      thumbnail: undefined,
      uploader: undefined,
      channel: undefined,
      author: undefined,
      uploadDate: undefined,
      duration: undefined,
      media: [],
      rawMetadata: { error: error.message, url },
    };
  }
}
