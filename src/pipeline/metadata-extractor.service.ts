import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  MediaMetadata,
  YtdlpFormat,
  YtdlpEntry,
} from './types';
import { LoggerService } from './logger.service';

const execAsync = promisify(exec);

@Injectable()
export class MetadataExtractorService {
  private readonly ytdlpPath: string;
  private readonly ffmpegPath: string;
  private readonly cookieFilePath: string;
  private readonly enableCookies: boolean;
  private readonly tempStoragePath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.ytdlpPath =
      this.configService.get<string>('YTDLP_PATH') || 'yt-dlp';
    this.ffmpegPath =
      this.configService.get<string>('FFMPEG_PATH') || '/opt/homebrew/bin/ffmpeg';
    this.cookieFilePath =
      this.configService.get<string>('COOKIE_FILE_PATH') || './cookies.txt';
    this.enableCookies =
      this.configService.get<string>('ENABLE_COOKIES') === 'true';
    this.tempStoragePath =
      this.configService.get<string>('TEMP_STORAGE_PATH') || './temp';
  }

  async extract(url: string): Promise<MediaMetadata> {
    this.logger.log('Extracting metadata', { url });

    const isTikTok = /tiktok\.com|vm\.tiktok\.com/i.test(url);
    const maxRetries = isTikTok ? 3 : 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const args = this.buildArgs(url);
      const command = `${this.ytdlpPath} ${args} --dump-json "${url}"`;

      this.logger.debug('Executing yt-dlp', { command, attempt });

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 60000,
          maxBuffer: 50 * 1024 * 1024,
        });

        if (stderr) {
          this.logger.warn('yt-dlp stderr', { stderr: stderr.trim() });
        }

        const rawData = JSON.parse(stdout);
        const metadata = this.mapToMetadata(rawData, url);

        this.logger.log('Metadata extracted successfully', {
          platform: metadata.platform,
          mediaType: metadata.mediaType,
          title: metadata.title,
        });

        return metadata;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message || '';

        if (errorMsg.includes('There is no video in this post') || errorMsg.includes('No video formats found')) {
          this.logger.log('Instagram image post detected, creating fallback metadata', { url });
          return this.createImagePostMetadata(url);
        }

        if (errorMsg.includes('No video found') || errorMsg.includes('Unsupported URL')) {
          this.logger.log('Creating minimal metadata for unsupported content', { url });
          return this.createImagePostMetadata(url);
        }

        this.logger.warn('yt-dlp attempt failed', {
          attempt,
          maxRetries,
          error: errorMsg.slice(0, 200),
        });

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (isTikTok && lastError) {
      this.logger.log('TikTok metadata extraction failed, creating fallback metadata', { url });
      return this.createTikTokFallbackMetadata(url);
    }

    this.logger.error('yt-dlp execution failed', lastError?.message, { url });
    throw lastError;
  }

  async extractPlaylist(url: string): Promise<MediaMetadata[]> {
    this.logger.log('Extracting playlist metadata', { url });

    const args = this.buildArgs(url, true);
    const command = `${this.ytdlpPath} ${args} --dump-json --flat-playlist "${url}"`;

    try {
      const { stdout } = await execAsync(command, {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
      });

      const lines = stdout.trim().split('\n');
      const results: MediaMetadata[] = [];

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            results.push(this.mapToMetadata(data, url));
          } catch {
            this.logger.warn('Failed to parse playlist entry');
          }
        }
      }

      return results;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Playlist extraction failed', message, { url });
      throw error;
    }
  }

  private buildArgs(url: string, flat = false): string {
    const args: string[] = [
      '--no-warnings',
      '--no-check-certificates',
      '--no-colors',
    ];

    if (this.ffmpegPath) {
      args.push(`--ffmpeg-location "${this.ffmpegPath}"`);
    }

    if (this.enableCookies && this.cookieFilePath) {
      const cookiePath = path.resolve(this.cookieFilePath);
      if (fs.existsSync(cookiePath)) {
        args.push(`--cookies "${cookiePath}"`);
        this.logger.debug('Using cookies', { cookiePath });
      } else {
        this.logger.warn('Cookie file not found', { cookiePath });
      }
    }

    if (flat) {
      args.push('--flat-playlist');
    }

    return args.join(' ');
  }

  private mapToMetadata(data: Record<string, unknown>, url: string): MediaMetadata {
    const formats = this.mapFormats(data.formats as Record<string, unknown>[] | undefined);
    const entries = this.mapEntries(data.entries as Record<string, unknown>[] | undefined);

    return {
      id: data.id as string,
      title: (data.title as string) || (data.fulltitle as string),
      caption: (data.description as string) || (data.title as string),
      description: data.description as string,
      uploader: data.uploader as string,
      channel: data.channel as string,
      author: data.author as string,
      uploadDate: data.upload_date as string,
      thumbnail: data.thumbnail as string,
      duration: data.duration as number,
      platform: undefined as any,
      mediaType: undefined as any,
      url,
      webpageUrl: data.webpage_url as string,
      originalUrl: data.original_url as string,
      width: data.width as number,
      height: data.height as number,
      ext: data.ext as string,
      formats,
      entries,
      rawMetadata: data,
    };
  }

  private mapFormats(
    rawFormats: Record<string, unknown>[] | undefined,
  ): YtdlpFormat[] {
    if (!rawFormats) return [];
    return rawFormats.map((f) => ({
      format_id: f.format_id as string,
      ext: f.ext as string,
      resolution: f.resolution as string,
      width: f.width as number,
      height: f.height as number,
      fps: f.fps as number,
      filesize: f.filesize as number,
      vcodec: f.vcodec as string,
      acodec: f.acodec as string,
      url: f.url as string,
      quality: f.quality as string,
    }));
  }

  private mapEntries(
    rawEntries: Record<string, unknown>[] | undefined,
  ): YtdlpEntry[] {
    if (!rawEntries) return [];
    return rawEntries.map((e) => ({
      id: e.id as string,
      title: e.title as string,
      url: e.url as string,
      ext: e.ext as string,
      thumbnail: e.thumbnail as string,
      duration: e.duration as number,
      width: e.width as number,
      height: e.height as number,
      filesize: e.filesize as number,
      formats: this.mapFormats(e.formats as Record<string, unknown>[]),
    }));
  }

  private createImagePostMetadata(url: string): MediaMetadata {
    const id = url.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1] ||
               url.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] ||
               Date.now().toString();

    return {
      id,
      title: `Instagram Post ${id}`,
      caption: '',
      description: '',
      uploader: '',
      channel: undefined,
      author: undefined,
      uploadDate: undefined,
      thumbnail: undefined,
      duration: undefined,
      platform: undefined as any,
      mediaType: undefined as any,
      url,
      webpageUrl: url,
      originalUrl: url,
      width: undefined,
      height: undefined,
      ext: 'jpg',
      formats: [],
      entries: [],
      rawMetadata: { source: 'fallback', originalUrl: url },
    };
  }

  private createTikTokFallbackMetadata(url: string): MediaMetadata {
    const id = url.match(/video\/(\d+)/)?.[1] ||
               url.match(/\/(\d+)/)?.[1] ||
               Date.now().toString();

    return {
      id,
      title: `TikTok Video ${id}`,
      caption: '',
      description: '',
      uploader: '',
      channel: undefined,
      author: undefined,
      uploadDate: undefined,
      thumbnail: undefined,
      duration: undefined,
      platform: undefined as any,
      mediaType: undefined as any,
      url,
      webpageUrl: url,
      originalUrl: url,
      width: undefined,
      height: undefined,
      ext: 'mp4',
      formats: [],
      entries: [],
      rawMetadata: { source: 'tiktok-fallback', originalUrl: url },
    };
  }
}
