import { Injectable } from '@nestjs/common';
import { Platform } from './types';

@Injectable()
export class PlatformDetectorService {
  private readonly platformPatterns: { pattern: RegExp; platform: Platform }[] =
    [
      {
        pattern:
          /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be|m\.youtube\.com)/i,
        platform: Platform.YOUTUBE,
      },
      {
        pattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com/i,
        platform: Platform.INSTAGRAM,
      },
      {
        pattern: /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com)/i,
        platform: Platform.TIKTOK,
      },
      {
        pattern:
          /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.watch|fb\.com)/i,
        platform: Platform.FACEBOOK,
      },
      {
        pattern:
          /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com|t\.co)/i,
        platform: Platform.TWITTER,
      },
    ];

  detect(url: string): Platform {
    for (const { pattern, platform } of this.platformPatterns) {
      if (pattern.test(url)) {
        return platform;
      }
    }
    return Platform.UNKNOWN;
  }

  isSupported(platform: Platform): boolean {
    return platform !== Platform.UNKNOWN;
  }
}
