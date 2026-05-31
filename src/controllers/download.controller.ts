import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PipelineService } from '../pipeline/pipeline.service';
import { ProcessDto } from '../dto/process.dto';

@ApiTags('Download')
@Controller()
export class DownloadController {
  private readonly downloadPath: string;

  constructor(private readonly pipelineService: PipelineService) {
    this.downloadPath =
      process.env.DOWNLOAD_PATH || '/tmp/media-downloads';
  }

  @Post('download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Download media from URL',
    description:
      'Accepts a social media URL and returns the downloaded media file directly.',
  })
  @ApiParam({
    name: 'url',
    description: 'Social media URL to download',
    example: 'https://www.instagram.com/reel/ABC123/',
  })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid URL' })
  @ApiResponse({ status: 404, description: 'No media found' })
  async download(
    @Body() processDto: ProcessDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.pipelineService.process(processDto);

    if (!result.success || result.media.length === 0) {
      throw new NotFoundException('No media could be downloaded');
    }

    const firstMedia = result.media[0];
    const filePath = firstMedia.filePath;

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    const filename = path.basename(filePath);

    res.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    res.sendFile(filePath);
  }
}
