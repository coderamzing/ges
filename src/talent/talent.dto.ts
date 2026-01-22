import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsBoolean, IsString, IsIn, IsBooleanString, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

// export class TalentRecommendationFiltersDto {
//   @ApiPropertyOptional({ description: 'Filter by openchat', example: true })
//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   openchat?: boolean;

//   @ApiPropertyOptional({ description: 'Filter by DM sent', example: true })
//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   dmSent?: boolean;

//   @ApiPropertyOptional({ description: 'Filter by FirstChoice priority status', example: true })
//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   firstChoice?: boolean;

//   @ApiPropertyOptional({ description: 'Filter by Backup guests priority status', example: true })
//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   backupGuests?: boolean;

//   @ApiPropertyOptional({ description: 'Filter by blacklist', example: false })
//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   blacklist?: boolean;

//   @ApiPropertyOptional({ description: 'Filter by liked', example: true })
//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   liked?: boolean;

//   @ApiPropertyOptional({ description: 'Filter by hide', example: false })
//   @IsOptional()
//   @Type(() => Boolean)
//   @IsBoolean()
//   hide?: boolean;

//   @ApiPropertyOptional({ description: 'Filter by talent type', example: 'civilian' })
//   @IsOptional()
//   @IsString()
//   talentType?: string;

//   @ApiPropertyOptional({ description: 'Minimum trust score', example: 0 })
//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   trustScore?: number;

//   @ApiPropertyOptional({ description: 'Limit number of results', default: 100 })
//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   @Min(1)
//   limit?: number;
// }


export class TalentRecommendationFiltersDto {
  @ApiPropertyOptional({ description: 'Show only talents who have replied before', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  openchat?: boolean;

  @ApiPropertyOptional({ description: 'Show only talents already messaged in this batch', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  dmSent?: boolean;



  @ApiPropertyOptional({ description: 'Show only blacklisted talents', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  blacklist?: boolean;

  @ApiPropertyOptional({
    description: 'Select one or more talent types',
    example: ['civilian', 'model'],
    isArray: true,
    enum: ['civilian', 'hybrid', 'supermodel', 'model'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      return value.includes(',')
        ? value.split(',').map(v => v.trim())
        : [value];
    }
    return value;
  })
  @IsArray()
  @IsIn(['civilian', 'hybrid', 'supermodel', 'model'], { each: true })
  talentType?: string[];



  @ApiPropertyOptional({
    description: 'Trust score range. Examples: "10-40", "25"',
    example: '10-40',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const input = String(value).trim();

    // single number → min only
    if (/^\d+$/.test(input)) {
      return {
        min: Number(input),
        max: undefined,
      };
    }

    // range: min-max
    if (/^\d+\s*-\s*\d+$/.test(input)) {
      const [minStr, maxStr] = input.split('-').map(v => v.trim());

      const min = Number(minStr);
      const max = Number(maxStr);

      if (max <= min) {
        throw new BadRequestException(
          'trustScoreRange: max value must be greater than min value',
        );
      }

      return { min, max };
    }

    throw new BadRequestException(
      'trustScoreRange format must be "min-max" or "min"',
    );
  })
  trustScoreRange?: {
    min: number;
    max?: number;
  };

  @ApiPropertyOptional({
    description: 'Show only talents recommended by AI',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  recommendation?: boolean;


  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 100,
    example: 50
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

