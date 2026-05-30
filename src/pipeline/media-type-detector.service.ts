import { Injectable } from '@nestjs/common';
import { MediaType, MediaMetadata, YtdlpEntry } from './types';

@Injectable()
export class MediaTypeDetectorService {
  detect(metadata: MediaMetadata): MediaType {
    if (metadata.entries && metadata.entries.length > 1) {
      return MediaType.CAROUSEL;
    }

    if (metadata.entries && metadata.entries.length === 1) {
      return this.detectFromEntry(metadata.entries[0]);
    }

    return this.detectFromMetadata(metadata);
  }

  private detectFromEntry(entry: YtdlpEntry): MediaType {
    const hasVideo = this.isVideoContent(entry);
    const hasImage = this.isImageContent(entry);

    if (hasVideo && hasImage) {
      return MediaType.MIXED_MEDIA;
    }
    if (hasVideo) {
      return MediaType.VIDEO;
    }
    if (hasImage) {
      return MediaType.IMAGE;
    }
    return MediaType.VIDEO;
  }

  private detectFromMetadata(metadata: MediaMetadata): MediaType {
    const ext = metadata.ext?.toLowerCase();
    const videoExtensions = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

    if (ext && videoExtensions.includes(ext)) {
      return MediaType.VIDEO;
    }
    if (ext && imageExtensions.includes(ext)) {
      return MediaType.IMAGE;
    }

    if (metadata.duration && metadata.duration > 0) {
      return MediaType.VIDEO;
    }

    if (metadata.formats && metadata.formats.length > 0) {
      const hasVideoFormat = metadata.formats.some(
        (f) => f.vcodec && f.vcodec !== 'none',
      );
      const hasImageOnly = metadata.formats.every(
        (f) => !f.vcodec || f.vcodec === 'none',
      );

      if (hasVideoFormat) {
        return MediaType.VIDEO;
      }
      if (hasImageOnly) {
        return MediaType.IMAGE;
      }
    }

    return MediaType.VIDEO;
  }

  private isVideoContent(entry: YtdlpEntry): boolean {
    if (entry.duration && entry.duration > 0) return true;
    if (entry.formats) {
      return entry.formats.some((f) => f.vcodec && f.vcodec !== 'none');
    }
    const videoExtensions = ['mp4', 'mkv', 'webm', 'avi', 'mov'];
    return videoExtensions.includes(entry.ext?.toLowerCase() || '');
  }

  private isImageContent(entry: YtdlpEntry): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    return imageExtensions.includes(entry.ext?.toLowerCase() || '');
  }
}
