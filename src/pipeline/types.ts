export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  CAROUSEL = 'carousel',
  MIXED_MEDIA = 'mixed_media',
}

export enum Platform {
  YOUTUBE = 'youtube',
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  FACEBOOK = 'facebook',
  TWITTER = 'twitter',
  UNKNOWN = 'unknown',
}

export interface MediaMetadata {
  id?: string;
  title?: string;
  caption?: string;
  description?: string;
  uploader?: string;
  channel?: string;
  author?: string;
  uploadDate?: string;
  thumbnail?: string;
  duration?: number;
  platform: Platform;
  mediaType: MediaType;
  url: string;
  webpageUrl?: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  ext?: string;
  formats?: YtdlpFormat[];
  entries?: YtdlpEntry[];
  rawMetadata?: Record<string, unknown>;
}

export interface YtdlpFormat {
  format_id: string;
  ext: string;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  url?: string;
  quality?: string;
}

export interface YtdlpEntry {
  id: string;
  title: string;
  url: string;
  ext: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  filesize?: number;
  formats?: YtdlpFormat[];
  [key: string]: unknown;
}

export interface DownloadedMedia {
  type: MediaType;
  filePath: string;
  size: number;
  filename: string;
  downloadUrl?: string;
  originalUrl?: string;
}

export interface PipelineResult {
  success: boolean;
  platform: string;
  mediaType: string;
  title?: string;
  caption?: string;
  description?: string;
  thumbnail?: string;
  uploader?: string;
  channel?: string;
  author?: string;
  uploadDate?: string;
  duration?: number;
  media: DownloadedMedia[];
  rawMetadata?: Record<string, unknown>;
}

export interface ProcessRequest {
  url: string;
}
