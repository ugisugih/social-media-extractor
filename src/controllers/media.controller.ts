import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  private readonly downloadPath: string;

  constructor() {
    this.downloadPath = process.env.DOWNLOAD_PATH || './downloads';
  }

  @Get(':filename')
  @ApiOperation({
    summary: 'Download a media file',
    description: 'Serve a previously downloaded media file by filename.',
  })
  @ApiParam({
    name: 'filename',
    description: 'The filename of the media to download',
    example: 'video_1234567890_abc12345.mp4',
  })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async download(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(this.downloadPath, sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File not found: ${sanitizedFilename}`);
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.srt': 'text/plain',
      '.vtt': 'text/vtt',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Content-Length': stats.size.toString(),
      'Content-Disposition': `inline; filename="${sanitizedFilename}"`,
      'Cache-Control': 'public, max-age=31536000',
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
