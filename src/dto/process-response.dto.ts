import { ApiProperty } from '@nestjs/swagger';

export class ProcessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'instagram' })
  platform: string;

  @ApiProperty({ example: 'video' })
  mediaType: string;

  @ApiProperty({ example: 'Amazing sunset video' })
  title?: string;

  @ApiProperty({ example: 'Check out this sunset' })
  caption?: string;

  @ApiProperty({ example: 'A beautiful sunset over the ocean' })
  description?: string;

  @ApiProperty({ example: 'https://example.com/thumb.jpg' })
  thumbnail?: string;

  @ApiProperty({ example: 'john_doe' })
  uploader?: string;

  @ApiProperty({ example: 'Travel Channel' })
  channel?: string;

  @ApiProperty({ example: 'John Doe' })
  author?: string;

  @ApiProperty({ example: '20240101' })
  uploadDate?: string;

  @ApiProperty({ example: 120 })
  duration?: number;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'video' },
        filePath: { type: 'string', example: '/downloads/video_123.mp4' },
        size: { type: 'number', example: 12345678 },
        filename: { type: 'string', example: 'video_123.mp4' },
      },
    },
  })
  media: Array<{
    type: string;
    filePath: string;
    size: number;
    filename: string;
  }>;

  @ApiProperty({ required: false })
  rawMetadata?: Record<string, unknown>;
}
