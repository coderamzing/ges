import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsIn,
} from 'class-validator';
import { TemplateType } from '@prisma/client';

export class CreateCampaignTemplateDto {
  @ApiProperty({ description: 'ID of the campaign this template belongs to' })
  @IsInt()
  @IsNotEmpty()
  campaignId: number;

  @ApiProperty({ description: 'Language of the template' })
  @IsString()
  @IsNotEmpty()
  lang: string;

  @ApiProperty({ 
    description: 'Type of template',
    enum: TemplateType,
    example: TemplateType.invitation
  })
  @IsEnum(TemplateType)
  @IsNotEmpty()
  type: TemplateType;

  @ApiProperty({ description: 'Name of the template' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Content of the template' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ 
    description: 'Status of the template',
    enum: ['draft', 'active', 'archived'],
    example: 'draft'
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['draft', 'active', 'archived'])
  status: string;
}

export class UpdateCampaignTemplateDto {
  @ApiPropertyOptional({ description: 'ID of the campaign this template belongs to' })
  @IsInt()
  @IsOptional()
  campaignId?: number;

  @ApiPropertyOptional({ description: 'Language of the template' })
  @IsString()
  @IsOptional()
  lang?: string;

  @ApiPropertyOptional({ 
    description: 'Type of template',
    enum: TemplateType,
    example: TemplateType.followup
  })
  @IsEnum(TemplateType)
  @IsOptional()
  type?: TemplateType;

  @ApiPropertyOptional({ description: 'Name of the template' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Content of the template' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ 
    description: 'Status of the template',
    enum: ['draft', 'active', 'archived'],
    example: 'active'
  })
  @IsString()
  @IsOptional()
  @IsIn(['draft', 'active', 'archived'])
  status?: string;
}

export class PreviewTemplateDto {
  @ApiProperty({ description: 'ID of the event to use for template variables' })
  @IsInt()
  @IsNotEmpty()
  eventId: number;

  @ApiProperty({ description: 'Template string with variables to preview' })
  @IsString()
  @IsNotEmpty()
  template: string;
}

