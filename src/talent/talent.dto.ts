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
    description: 'Filter talents by cities',
    example: ['Delhi', 'Mumbai'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(v => v.trim());
    return value.split(',').map(v => v.trim());
  })
  city?: string[];


  @ApiPropertyOptional({
    description: 'Filter talents by countries',
    example: ['Italy', 'India'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(v => v.trim());
    return value.split(',').map(v => v.trim());
  })
  country?: string[];

  @ApiPropertyOptional({
    description: 'Filter talents by hair colors',
    example: ['Blonde', 'Black'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(v => v.trim());
    return value.split(',').map(v => v.trim());
  })
  hairColor?: string[];


  @ApiPropertyOptional({
    description: 'Filter talents by ethnicity',
    example: ['Caucasian/European', 'Asian', 'African'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(v => v.trim());
    return value.split(',').map(v => v.trim());
  })
  ethnicity?: string[];



  @ApiPropertyOptional({
    description: 'Filter talents by statusIds',
    example: [18, 23, 34],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(Number); //supports: statusId=18,23,34 OR statusId[]=18&statusId[]=23  
    return value.split(',').map(Number);
  })
  statusId?: number[];

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
  genre?: string[];



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

