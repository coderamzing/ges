import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  ArrayMinSize,
  IsEnum,
} from 'class-validator';
import { CampaignStatus } from '@prisma/client';

export class CreateCampaignDto {
  @ApiProperty({ description: 'ID of the event this campaign belongs to' })
  @IsInt()
  @IsNotEmpty()
  eventId: number;

  @ApiProperty({ description: 'Name of the campaign' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    description: 'Status of the campaign',
    enum: CampaignStatus,
    example: CampaignStatus.draft
  })
  @IsEnum(CampaignStatus)
  @IsNotEmpty()
  status: CampaignStatus;

  @ApiProperty({ description: 'Language of the campaign' })
  @IsString()
  @IsNotEmpty()
  lang: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional({ description: 'ID of the event this campaign belongs to' })
  @IsInt()
  @IsOptional()
  eventId?: number;

  @ApiPropertyOptional({ description: 'Name of the campaign' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ 
    description: 'Status of the campaign',
    enum: CampaignStatus,
    example: CampaignStatus.active
  })
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @ApiPropertyOptional({ description: 'Language of the campaign' })
  @IsString()
  @IsOptional()
  lang?: string;
}

export class UpdateCampaignStatusDto {
  @ApiProperty({ 
    description: 'Status of the campaign',
    enum: CampaignStatus,
    example: CampaignStatus.active
  })
  @IsEnum(CampaignStatus)
  @IsNotEmpty()
  status: CampaignStatus;
}

export class AddTalentsToCampaignDto {
  @ApiProperty({ 
    description: 'List of talent IDs to add to the campaign',
    type: [Number],
    example: [1, 2, 3]
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  talentIds: number[];
}

