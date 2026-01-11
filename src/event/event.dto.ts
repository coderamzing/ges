import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ description: 'Name of the event' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Type of the event' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'City where the event takes place' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'Date of the event', example: '2024-12-25T00:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ description: 'Maximum capacity of the event' })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiPropertyOptional({ description: 'Event start time', example: '2024-12-25T18:00:00Z' })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({ description: 'Event end time', example: '2024-12-25T23:00:00Z' })
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiProperty({ description: 'Time to reach the event location', example: '2024-12-25T17:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  reach_time: string;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Name of the event' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Type of the event' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'City where the event takes place' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Date of the event', example: '2024-12-25T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Maximum capacity of the event' })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Event start time', example: '2024-12-25T18:00:00Z' })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({ description: 'Event end time', example: '2024-12-25T23:00:00Z' })
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional({ description: 'Time to reach the event location', example: '2024-12-25T17:00:00Z' })
  @IsDateString()
  @IsOptional()
  reach_time?: string;
}

