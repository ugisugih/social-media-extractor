export interface PlatformConfig {
  name: string;
  format: string;
  mergeOutputFormat: string;
  writeThumbnail: boolean;
  convertThumbnails: boolean;
  extraArgs: string[];
  resolveUrl: boolean;
  retries: number;
}

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  tiktok: {
    name: 'tiktok',
    format: 'h264_720p_1289746-0/h264_540p_490678-0/h264*',
    mergeOutputFormat: 'mp4',
    writeThumbnail: false,
    convertThumbnails: false,
    extraArgs: [],
    resolveUrl: true,
    retries: 3,
  },
  youtube: {
    name: 'youtube',
    format: 'best[ext=mp4]/best',
    mergeOutputFormat: '',
    writeThumbnail: true,
    convertThumbnails: true,
    extraArgs: [],
    resolveUrl: false,
    retries: 1,
  },
  instagram: {
    name: 'instagram',
    format: 'best[ext=mp4]/best',
    mergeOutputFormat: '',
    writeThumbnail: true,
    convertThumbnails: true,
    extraArgs: [],
    resolveUrl: false,
    retries: 1,
  },
  facebook: {
    name: 'facebook',
    format: 'best[ext=mp4]/best',
    mergeOutputFormat: '',
    writeThumbnail: true,
    convertThumbnails: true,
    extraArgs: [],
    resolveUrl: false,
    retries: 1,
  },
  twitter: {
    name: 'twitter',
    format: 'best[ext=mp4]/best',
    mergeOutputFormat: '',
    writeThumbnail: true,
    convertThumbnails: true,
    extraArgs: [],
    resolveUrl: false,
    retries: 1,
  },
};

export function getPlatformConfig(platform: string): PlatformConfig {
  return PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS['youtube'];
}
