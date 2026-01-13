import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { TemplateType } from '@prisma/client';

export class CreateCampaignSpintaxTemplateDto {
  @ApiProperty({ description: 'ID of the campaign template this spintax belongs to' })
  @IsInt()
  @IsNotEmpty()
  CampaignTemplateId: number;

  @ApiProperty({ description: 'ID of the campaign this spintax belongs to' })
  @IsInt()
  @IsNotEmpty()
  campaignId: number;

  @ApiProperty({ description: 'Language of the spintax template' })
  @IsString()
  @IsNotEmpty()
  lang: string;

  @ApiProperty({ 
    description: 'Type of spintax template',
    enum: TemplateType,
    example: TemplateType.invitation
  })
  @IsEnum(TemplateType)
  @IsNotEmpty()
  type: TemplateType;

  @ApiProperty({ description: 'Name of the spintax template' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Content of the spintax template' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ 
    description: 'Batch number (1 or 2)',
    default: 1,
    minimum: 1,
    maximum: 2,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(2)
  batch?: number;
}

export class UpdateCampaignSpintaxTemplateDto {
  @ApiPropertyOptional({ description: 'ID of the campaign template this spintax belongs to' })
  @IsInt()
  @IsOptional()
  CampaignTemplateId?: number;

  @ApiPropertyOptional({ description: 'ID of the campaign this spintax belongs to' })
  @IsInt()
  @IsOptional()
  campaignId?: number;

  @ApiPropertyOptional({ description: 'Language of the spintax template' })
  @IsString()
  @IsOptional()
  lang?: string;

  @ApiPropertyOptional({ 
    description: 'Type of spintax template',
    enum: TemplateType,
    example: TemplateType.followup
  })
  @IsEnum(TemplateType)
  @IsOptional()
  type?: TemplateType;

  @ApiPropertyOptional({ description: 'Name of the spintax template' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Content of the spintax template' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ 
    description: 'Batch number (1 or 2)',
    minimum: 1,
    maximum: 2,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(2)
  batch?: number;
}

