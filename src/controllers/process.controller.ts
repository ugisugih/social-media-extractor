import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PipelineService } from '../pipeline/pipeline.service';
import { ProcessDto } from '../dto/process.dto';
import { ProcessResponseDto } from '../dto/process-response.dto';

@ApiTags('Process')
@Controller()
export class ProcessController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a social media URL',
    description:
      'Accepts a social media URL and automatically extracts metadata, detects media type, downloads media, and returns a unified response.',
  })
  @ApiResponse({
    status: 200,
    description: 'Media processed successfully',
    type: ProcessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid URL or request' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async process(@Body() processDto: ProcessDto): Promise<ProcessResponseDto> {
    const result = await this.pipelineService.process(processDto);
    return result as ProcessResponseDto;
  }
}
