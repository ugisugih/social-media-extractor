import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PipelineService } from './pipeline.service';
import { MetadataExtractorService } from './metadata-extractor.service';
import { PlatformDetectorService } from './platform-detector.service';
import { MediaTypeDetectorService } from './media-type-detector.service';
import { ImageHandler } from './handlers/image.handler';
import { VideoHandler } from './handlers/video.handler';
import { CarouselHandler } from './handlers/carousel.handler';
import { ResponseBuilderService } from './response-builder.service';
import { LoggerService } from './logger.service';

@Module({
  imports: [ConfigModule],
  providers: [
    PipelineService,
    MetadataExtractorService,
    PlatformDetectorService,
    MediaTypeDetectorService,
    ImageHandler,
    VideoHandler,
    CarouselHandler,
    ResponseBuilderService,
    LoggerService,
  ],
  exports: [PipelineService],
})
export class PipelineModule {}
