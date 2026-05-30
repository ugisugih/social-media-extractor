import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  MediaType,
  DownloadedMedia,
  YtdlpEntry,
  MediaMetadata,
} from '../types';
import { LoggerService } from '../logger.service';
import { ImageHandler } from './image.handler';
import { VideoHandler } from './video.handler';

const execAsync = promisify(exec);

@Injectable()
export class CarouselHandler {
  private readonly downloadPath: string;
  private readonly ytdlpPath: string;
  private readonly ffmpegPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly imageHandler: ImageHandler,
    private readonly videoHandler: VideoHandler,
  ) {
    this.downloadPath =
      this.configService.get<string>('DOWNLOAD_PATH') || './downloads';
    this.ytdlpPath =
      this.configService.get<string>('YTDLP_PATH') || 'yt-dlp';
    this.ffmpegPath =
      this.configService.get<string>('FFMPEG_PATH') || '/opt/homebrew/bin/ffmpeg';
  }

  async download(
    url: string,
    metadata: MediaMetadata,
  ): Promise<DownloadedMedia[]> {
    this.logger.log('Processing carousel download', { url });

    if (metadata.entries && metadata.entries.length > 0) {
      return this.downloadFromEntries(url, metadata.entries);
    }

    return this.downloadCarouselDirect(url);
  }

  private async downloadFromEntries(
    url: string,
    entries: YtdlpEntry[],
  ): Promise<DownloadedMedia[]> {
    this.logger.log('Downloading carousel from entries', {
      count: entries.length,
    });

    const allMedia: DownloadedMedia[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      this.logger.log(`Processing carousel item ${i + 1}/${entries.length}`, {
        id: entry.id,
        title: entry.title,
      });

      try {
        const isVideo = this.isVideoEntry(entry);
        const itemUrl = entry.url || `${url}?

index=${i}`;

        if (isVideo) {
          const media = await this.videoHandler.download(itemUrl, entry as unknown as Record<string, unknown>);
          allMedia.push(...media);
        } else {
          const media = await this.imageHandler.download(itemUrl, entry as unknown as Record<string, unknown>);
          allMedia.push(...media);
        }
      } catch (error) {
        this.logger.error(
          `Failed to download carousel item ${i + 1}`,
          error.message,
          { entryId: entry.id },
        );
      }
    }

    return allMedia;
  }

  private async downloadCarouselDirect(url: string): Promise<DownloadedMedia[]> {
    this.logger.log('Attempting direct carousel download', { url });

    await this.ensureDownloadDir();

    const baseFilename = this.generateFilename(url, 'carousel');
    const outputTemplate = path.join(
      this.downloadPath,
      `${baseFilename}_%(playlist_index)s.%(ext)s`,
    );

    const args = [
      '--no-warnings',
      '--no-check-certificates',
      '--no-colors',
      '-f', 'best',
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      `-o "${outputTemplate}"`,
    ];

    if (this.ffmpegPath) {
      args.push(`--ffmpeg-location "${this.ffmpegPath}"`);
    }

    const command = `${this.ytdlpPath} ${args.join(' ')} "${url}"`;

    try {
      await execAsync(command, {
        timeout: 300000,
        maxBuffer: 50 * 1024 * 1024,
      });

      const files = fs.readdirSync(this.downloadPath);
      const carouselFiles = files.filter((f) => f.startsWith(baseFilename));

      return carouselFiles.map((file) => {
        const filePath = path.join(this.downloadPath, file);
        const stats = fs.statSync(filePath);
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
        return {
          type: isImage ? MediaType.IMAGE : MediaType.VIDEO,
          filePath,
          size: stats.size,
          filename: file,
          originalUrl: url,
        };
      });
    } catch (error) {
      this.logger.error('Direct carousel download failed', error.message, {
        url,
      });
      throw error;
    }
  }

  private isVideoEntry(entry: YtdlpEntry): boolean {
    if (entry.duration && entry.duration > 0) return true;
    if (entry.formats) {
      return entry.formats.some((f) => f.vcodec && f.vcodec !== 'none');
    }
    const videoExtensions = ['mp4', 'mkv', 'webm', 'avi', 'mov'];
    return videoExtensions.includes(entry.ext?.toLowerCase() || '');
  }

  private generateFilename(url: string, prefix: string): string {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const timestamp = Date.now();
    return `${prefix}_${timestamp}_${hash.substring(0, 8)}`;
  }

  private async ensureDownloadDir(): Promise<void> {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
  }
}
