import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MediaType, DownloadedMedia } from '../types';
import { LoggerService } from '../logger.service';
import { getPlatformConfig, PlatformConfig } from '../platform-config';

const execAsync = promisify(exec);

@Injectable()
export class VideoHandler {
  private readonly downloadPath: string;
  private readonly ytdlpPath: string;
  private readonly ffmpegPath: string;
  private readonly cookieFilePath: string;
  private readonly enableCookies: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.downloadPath =
      this.configService.get<string>('DOWNLOAD_PATH') || '/tmp/media-downloads';
    this.ytdlpPath =
      this.configService.get<string>('YTDLP_PATH') || 'yt-dlp';
    this.ffmpegPath =
      this.configService.get<string>('FFMPEG_PATH') || '/opt/homebrew/bin/ffmpeg';
    this.cookieFilePath =
      this.configService.get<string>('COOKIE_FILE_PATH') || './cookies.txt';
    this.enableCookies =
      this.configService.get<string>('ENABLE_COOKIES') === 'true';
  }

  async download(url: string, _metadata: Record<string, unknown>): Promise<DownloadedMedia[]> {
    const platform = _metadata?.platform as string || this.detectPlatform(url);
    const config = getPlatformConfig(platform);

    this.logger.log('Processing video download', { url, platform, config: config.name });

    await this.ensureDownloadDir();
    await this.verifyFfmpeg();

    let downloadUrl = url;
    if (config.resolveUrl) {
      downloadUrl = await this.resolveUrl(url);
      this.logger.log('Resolved URL', { original: url, resolved: downloadUrl });
    }

    const filename = this.generateFilename(url, 'video');
    const outputPath = path.join(this.downloadPath, `${filename}.%(ext)s`);

    const args = this.buildArgs(config, outputPath, downloadUrl);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.retries; attempt++) {
      const command = `${this.ytdlpPath} ${args} "${downloadUrl}"`;

      this.logger.log('Executing yt-dlp', { attempt, retries: config.retries, command });

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 300000,
          maxBuffer: 50 * 1024 * 1024,
        });

        if (stderr) {
          this.logger.warn('yt-dlp stderr', { stderr: stderr.slice(0, 500) });
        }

        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        this.logger.warn('yt-dlp attempt failed', {
          attempt,
          retries: config.retries,
          error: error.message.slice(0, 200),
        });

        if (attempt < config.retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (lastError) {
      this.logger.error('Video download failed', lastError.message, { url });
      throw lastError;
    }

    return this.collectResults(filename, url);
  }

  private buildArgs(config: PlatformConfig, outputPath: string, _url: string): string {
    const args: string[] = [
      '--no-warnings',
      '--no-check-certificates',
      '--no-colors',
      `-f "${config.format}"`,
      `-o "${outputPath}"`,
      `--ffmpeg-location "${this.ffmpegPath}"`,
    ];

    if (config.mergeOutputFormat) {
      args.push(`--merge-output-format ${config.mergeOutputFormat}`);
    }

    if (config.writeThumbnail) {
      args.push('--write-thumbnail');
    }

    if (config.convertThumbnails) {
      args.push('--convert-thumbnails jpg');
    }

    args.push(...config.extraArgs);

    if (this.enableCookies && this.cookieFilePath) {
      const cookiePath = path.resolve(this.cookieFilePath);
      if (fs.existsSync(cookiePath)) {
        args.push(`--cookies "${cookiePath}"`);
      }
    }

    return args.join(' ');
  }

  private async collectResults(filename: string, url: string): Promise<DownloadedMedia[]> {
    const files = fs.readdirSync(this.downloadPath);

    const videoFiles = files.filter(
      (f) =>
        f.startsWith(filename) &&
        /\.(mp4|mkv|webm|avi|mov)$/i.test(f) &&
        !f.includes('.jpg'),
    );

    const thumbnailFiles = files.filter(
      (f) =>
        f.startsWith(filename) && /\.(jpg|jpeg|png|webp)$/i.test(f),
    );

    const results: DownloadedMedia[] = [];

    for (const file of videoFiles) {
      const filePath = path.join(this.downloadPath, file);
      const stats = fs.statSync(filePath);
      results.push({
        type: MediaType.VIDEO,
        filePath,
        size: stats.size,
        filename: file,
        originalUrl: url,
      });
    }

    for (const file of thumbnailFiles) {
      const filePath = path.join(this.downloadPath, file);
      const stats = fs.statSync(filePath);
      results.push({
        type: MediaType.IMAGE,
        filePath,
        size: stats.size,
        filename: file,
        originalUrl: url,
      });
    }

    if (results.length === 0) {
      throw new Error('No video files were downloaded');
    }

    return results;
  }

  private detectPlatform(url: string): string {
    if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) return 'tiktok';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/instagram\.com/i.test(url)) return 'instagram';
    if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook';
    if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
    return 'youtube';
  }

  private async resolveUrl(url: string): Promise<string> {
    try {
      const command = `curl -L -s -o /dev/null -w "%{url_effective}" "${url}"`;
      const { stdout } = await execAsync(command, { timeout: 15000 });
      const resolved = stdout.trim();
      if (resolved && resolved.includes('tiktok.com')) {
        return resolved;
      }
    } catch (error) {
      this.logger.warn('Failed to resolve URL, using original', { error: error.message });
    }
    return url;
  }

  private async verifyFfmpeg(): Promise<void> {
    try {
      await execAsync(`"${this.ffmpegPath}" -version`, { timeout: 5000 });
    } catch {
      this.logger.warn('ffmpeg not found', { path: this.ffmpegPath });
    }
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
