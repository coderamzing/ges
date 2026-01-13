import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsInt, IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';
import { InvitationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class GetInvitationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter invitations by status',
    enum: InvitationStatus,
    example: InvitationStatus.sent,
  })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @ApiPropertyOptional({
    description: 'Filter invitations by reply status (true = has replied, false = no reply)',
    type: Boolean,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  hasReplied?: boolean;
}

export class MarkInvitationsAsAttendedDto {
  @ApiProperty({
    description: 'ID of the campaign',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  campaignId: number;

  @ApiProperty({
    description: 'Array of invitation IDs to mark as attended',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one invitation ID is required' })
  @IsInt({ each: true })
  @IsNotEmpty()
  invitationIds: number[];
}

export class MarkInvitationsForFollowupDto {
  @ApiProperty({
    description: 'ID of the campaign',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  campaignId: number;

  @ApiProperty({
    description: 'Array of invitation IDs to mark for followup',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one invitation ID is required' })
  @IsInt({ each: true })
  @IsNotEmpty()
  invitationIds: number[];
}

