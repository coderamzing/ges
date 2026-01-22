import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateAiPromptDto {
  @ApiPropertyOptional({ description: 'Prompt definitions/content' })
  @IsString()
  @IsOptional()
  defs?: string;

  @ApiPropertyOptional({ description: 'Role for the prompt' })
  @IsString()
  @IsOptional()
  role?: string;
}
