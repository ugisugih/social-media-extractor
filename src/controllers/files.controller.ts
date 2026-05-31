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

@ApiTags('Files')
@Controller('files')
export class FilesController {
  private readonly downloadPath: string;

  constructor() {
    this.downloadPath =
      process.env.DOWNLOAD_PATH || '/tmp/media-downloads';
  }

  @Get(':filename')
  @ApiOperation({
    summary: 'Download a file',
    description:
      'Serve any file stored in the download directory by filename.',
  })
  @ApiParam({
    name: 'filename',
    description: 'The filename to download',
    example: 'video_1234567890_abc12345.mp4',
  })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async download(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const sanitizedFilename = path.basename(filename);
    const resolvedDownload = path.resolve(this.downloadPath);
    const filePath = path.resolve(
      path.join(resolvedDownload, sanitizedFilename),
    );

    if (!filePath.startsWith(resolvedDownload + path.sep) && filePath !== resolvedDownload) {
      throw new NotFoundException(`File not found: ${sanitizedFilename}`);
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File not found: ${sanitizedFilename}`);
    }

    res.sendFile(filePath);
  }
}
