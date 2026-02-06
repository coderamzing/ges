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


  @ApiPropertyOptional({
    description: 'Search talents by  country',
    example: 'Italy',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  country?: string;

  @ApiPropertyOptional({
    description: 'Search talents by  hairColor',
    example: 'Blonde',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  hairColor?: string;


  @ApiPropertyOptional({
    description: 'Search talents by  ethnicity',
    example: 'Caucasian/European',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  ethnicity?: string;


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

