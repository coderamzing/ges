import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePromoterDto {
  @ApiProperty({ description: 'Email address of the promoter', example: 'promoter@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class UpdatePromoterDto {
  @ApiPropertyOptional({ description: 'Email address of the promoter', example: 'promoter@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;
}

