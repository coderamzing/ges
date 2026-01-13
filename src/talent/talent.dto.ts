import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsBoolean, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class TalentRecommendationFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by openchat', example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  openchat?: boolean;

  @ApiPropertyOptional({ description: 'Filter by DM sent', example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dmSent?: boolean;

  @ApiPropertyOptional({ description: 'Filter by FirstChoice priority status', example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  firstChoice?: boolean;

  @ApiPropertyOptional({ description: 'Filter by Backup guests priority status', example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  backupGuests?: boolean;

  @ApiPropertyOptional({ description: 'Filter by blacklist', example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  blacklist?: boolean;

  @ApiPropertyOptional({ description: 'Filter by liked', example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  liked?: boolean;

  @ApiPropertyOptional({ description: 'Filter by hide', example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hide?: boolean;

  @ApiPropertyOptional({ description: 'Filter by talent type', example: 'civilian' })
  @IsOptional()
  @IsString()
  talentType?: string;

  @ApiPropertyOptional({ description: 'Minimum trust score', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  trustScore?: number;

  @ApiPropertyOptional({ description: 'Limit number of results', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

