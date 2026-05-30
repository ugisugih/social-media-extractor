import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty } from 'class-validator';

export class ProcessDto {
  @ApiProperty({
    description: 'Social media URL to process',
    example: 'https://www.instagram.com/p/ABC123/',
  })
  @IsUrl({}, { message: 'Invalid URL format' })
  @IsNotEmpty({ message: 'URL is required' })
  url: string;
}
