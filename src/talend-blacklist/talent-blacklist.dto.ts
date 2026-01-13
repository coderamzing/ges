import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTalentBlacklistDto {
  @ApiProperty({ description: 'ID of the talent to blacklist' })
  @IsString()
  @IsNotEmpty()
  talentId: string;

  @ApiProperty({ description: 'Reason for blacklisting the talent' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class UpdateTalentBlacklistDto {
  @ApiPropertyOptional({ description: 'Reason for blacklisting the talent' })
  @IsString()
  @IsOptional()
  reason?: string;
}

