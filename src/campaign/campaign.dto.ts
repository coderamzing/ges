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
import { Type, Transform } from 'class-transformer';
import { CampaignStatus } from '@prisma/client';

export class CreateCampaignDto {
  @ApiProperty({ description: 'ID of the event this campaign belongs to' })
  @IsInt()
  @IsNotEmpty()
  eventId: number;

  @ApiPropertyOptional({ description: 'Name of the campaign. If not provided, will use the event name.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ 
    description: 'Status of the campaign. Defaults to draft if not provided.',
    enum: CampaignStatus,
    example: CampaignStatus.draft
  })
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @ApiPropertyOptional({ description: 'Language of the campaign. Defaults to "en" if not provided.' })
  @IsString()
  @IsOptional()
  lang?: string;
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
    description: 'List of talent IDs to add to the campaign (can be strings or numbers, will be converted to strings)',
    type: [String],
    example: ['irinashayk', 'talent2', 'talent3']
  })
  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) => value.map((id: any) => String(id)), { toClassOnly: true })
  @IsString({ each: true })
  talentIds: string[];

  @ApiPropertyOptional({ 
    description: 'Batch ID for the invitations. Defaults to 1 if not provided.',
    example: 1
  })
  @IsInt()
  @IsOptional()
  batchId?: number;
}

