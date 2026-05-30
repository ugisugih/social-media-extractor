import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MediaType, DownloadedMedia } from '../types';
import { LoggerService } from '../logger.service';

const execAsync = promisify(exec);

@Injectable()
export class ImageHandler {
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
    this.logger.log('Processing image download', { url });

    await this.ensureDownloadDir();

    if (this.isInstagramUrl(url)) {
      return this.downloadInstagramImage(url);
    }

    return this.downloadWithYtdlp(url);
  }

  private isInstagramUrl(url: string): boolean {
    return /instagram\.com/i.test(url);
  }

  private async downloadInstagramImage(url: string): Promise<DownloadedMedia[]> {
    this.logger.log('Downloading Instagram image', { url });

    const filename = this.generateFilename(url, 'instagram');

    const pageContent = await this.fetchPageContent(url);
    const imageUrls = this.extractInstagramImageUrls(pageContent);

    this.logger.log('Extracted image URLs', { count: imageUrls.length, urls: imageUrls.slice(0, 3) });

    if (imageUrls.length === 0) {
      this.logger.warn('No image URLs found from scraping, trying yt-dlp');
      return this.downloadWithYtdlp(url);
    }

    const results: DownloadedMedia[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const suffix = imageUrls.length > 1 ? `_${i + 1}` : '';
      const ext = this.getExtensionFromUrl(imageUrl);
      const imgFilename = `${filename}${suffix}.${ext}`;
      const imgPath = path.join(this.downloadPath, imgFilename);

      try {
        this.logger.log('Downloading image', { imageUrl, imgPath });
        await this.downloadSingleImage(imageUrl, imgPath);

        if (this.isValidImage(imgPath)) {
          const stats = fs.statSync(imgPath);
          this.logger.log('Image downloaded successfully', { imgPath, size: stats.size });
          results.push({
            type: MediaType.IMAGE,
            filePath: imgPath,
            size: stats.size,
            filename: imgFilename,
            originalUrl: imageUrl,
          });
        } else {
          this.logger.warn('Downloaded file is not valid, removing', { imgPath });
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }
      } catch (err) {
        this.logger.warn('Failed to download image', { imageUrl, error: err.message });
      }
    }

    if (results.length > 0) {
      return results;
    }

    this.logger.warn('All image downloads failed, trying yt-dlp as last resort');
    return this.downloadWithYtdlp(url);
  }

  private async fetchPageContent(url: string): Promise<string> {
    const command = `curl -L -s \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
      -H "Accept-Language: en-US,en;q=0.5" \
      -H "Accept-Encoding: identity" \
      -H "Sec-Fetch-Dest: document" \
      -H "Sec-Fetch-Mode: navigate" \
      -H "Sec-Fetch-Site: none" \
      "${url}"`;
    const { stdout } = await execAsync(command, { timeout: 30000, maxBuffer: 50 * 1024 * 1024 });
    return stdout;
  }

  private extractInstagramImageUrls(html: string): string[] {
    const imageUrls: string[] = [];

    const patterns = [
      /"display_url"\s*:\s*"([^"]+)"/g,
      /"image_versions2"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/g,
      /"carousel_media"\s*:\s*\[[\s\S]*?"image_versions2"[\s\S]*?"url"\s*:\s*"([^"]+)"/g,
      /<meta\s+property="og:image"\s+content="([^"]+)"/g,
      /<meta\s+content="([^"]+)"\s+property="og:image"/g,
      /"src"\s*:\s*"(https?:\/\/[^"]*(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1]
          .replace(/\\u0026/g, '&')
          .replace(/\\\//g, '/')
          .replace(/\\u003C/g, '<')
          .replace(/\\u003E/g, '>')
          .replace(/\\u0022/g, '"')
          .replace(/\\u0027/g, "'");

        if (this.isValidImageUrl(url) && !imageUrls.includes(url)) {
          imageUrls.push(url);
        }
      }
    }

    return [...new Set(imageUrls)].slice(0, 10);
  }

  private isValidImageUrl(url: string): boolean {
    if (!url || !url.startsWith('http')) return false;
    if (url.includes('profile_pic')) return false;
    if (url.includes('avatar')) return false;
    if (url.includes('icon')) return false;
    return true;
  }

  private async downloadSingleImage(imageUrl: string, outputPath: string): Promise<void> {
    const command = `curl -L -s -o "${outputPath}" \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
      -H "Accept: image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" \
      -H "Accept-Language: en-US,en;q=0.5" \
      -H "Referer: https://www.instagram.com/" \
      -H "Sec-Fetch-Dest: image" \
      -H "Sec-Fetch-Mode: no-cors" \
      -H "Sec-Fetch-Site: cross-site" \
      "${imageUrl}"`;

    await execAsync(command, { timeout: 30000 });
  }

  private isValidImage(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size < 1000) {
        this.logger.warn('File too small to be valid image', { size: stats.size });
        return false;
      }

      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      const header = buffer.toString('hex');

      if (header.startsWith('ffd8ff')) {
        this.logger.debug('Valid JPEG detected');
        return true;
      }
      if (header.startsWith('89504e47')) {
        this.logger.debug('Valid PNG detected');
        return true;
      }
      if (header.startsWith('47494638')) {
        this.logger.debug('Valid GIF detected');
        return true;
      }
      if (header.startsWith('52494646')) {
        this.logger.debug('Valid WebP detected');
        return true;
      }
      if (header.startsWith('424d')) {
        this.logger.debug('Valid BMP detected');
        return true;
      }

      const textContent = fs.readFileSync(filePath, 'utf-8').slice(0, 500);
      if (textContent.includes('<!DOCTYPE') || textContent.includes('<html') || textContent.includes('<!doctype')) {
        this.logger.warn('File is HTML, not an image');
        return false;
      }

      this.logger.warn('Unknown file header', { header: header.slice(0, 16) });
      return false;
    } catch (error) {
      this.logger.error('Error validating image', error.message);
      return false;
    }
  }

  private getExtensionFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = path.extname(pathname).toLowerCase().split('?')[0];

      const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      if (validExts.includes(ext)) {
        return ext.slice(1);
      }
    } catch {}

    return 'jpg';
  }

  private async downloadWithYtdlp(url: string): Promise<DownloadedMedia[]> {
    const filename = this.generateFilename(url, 'image');
    const outputPath = path.join(this.downloadPath, filename);

    const args = [
      '--no-warnings',
      '--no-check-certificates',
      '--no-colors',
      '--write-thumbnail',
      '--skip-download',
      '--convert-thumbnails jpg',
      `-o "${outputPath}.%(ext)s"`,
    ];

    if (this.ffmpegPath) {
      args.push(`--ffmpeg-location "${this.ffmpegPath}"`);
    }

    if (this.enableCookies && this.cookieFilePath) {
      const cookiePath = path.resolve(this.cookieFilePath);
      if (fs.existsSync(cookiePath)) {
        args.push(`--cookies "${cookiePath}"`);
      }
    }

    const command = `${this.ytdlpPath} ${args.join(' ')} "${url}"`;

    try {
      this.logger.log('Trying yt-dlp for image', { command });
      await execAsync(command, { timeout: 60000 });

      const files = fs.readdirSync(this.downloadPath);
      const imageFiles = files.filter(
        (f) => f.startsWith(filename) && /\.(jpg|jpeg|png|gif|webp)$/i.test(f),
      );

      if (imageFiles.length === 0) {
        this.logger.warn('yt-dlp produced no image files');
        return [];
      }

      return imageFiles
        .filter((f) => this.isValidImage(path.join(this.downloadPath, f)))
        .map((file) => {
          const filePath = path.join(this.downloadPath, file);
          const stats = fs.statSync(filePath);
          return {
            type: MediaType.IMAGE,
            filePath,
            size: stats.size,
            filename: file,
            originalUrl: url,
          };
        });
    } catch (error) {
      this.logger.warn('yt-dlp image download failed', { url, error: error.message });
      return [];
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
