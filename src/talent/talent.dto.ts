import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsBoolean, IsString, IsIn, IsBooleanString, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';


export class TalentRecommendationFiltersDto {
  @ApiPropertyOptional({
    description: 'Search talents by name, username, or city',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  search?: string;


  @ApiPropertyOptional({
    description: 'Search talents by  city',
    example: 'paris',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  city?: string;


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


  @ApiPropertyOptional({ description: 'Show only talents already messaged in this batch', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  firstChoice?: boolean;

  @ApiPropertyOptional({ description: 'Show only talents already messaged in this batch', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  liked?: boolean;


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

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

}

