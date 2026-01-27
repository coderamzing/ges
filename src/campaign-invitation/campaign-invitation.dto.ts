import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsInt, IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';
import { InvitationStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';




export class UpdateInvitationStatusDto {
  @IsEnum(InvitationStatus)
  status: InvitationStatus;
}


export class DeleteInvitationResponseDto {
  @ApiProperty({ example: 'Invitation 42 deleted successfully' })
  message: string;
}

export class GetInvitationsQueryDto {
  // @ApiPropertyOptional({
  //   description: 'Filter by invitation ID',
  //   example: 13,
  // })
  // @IsOptional()
  // @Type(() => Number)
  // @IsInt()
  // id?: number;

  @ApiPropertyOptional({
    description: 'Filter by one or multiple invitation statuses',
    enum: InvitationStatus,
    isArray: true,
    example: ['sent', 'attended'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  @IsEnum(InvitationStatus, { each: true })
  status?: InvitationStatus[];


  @ApiPropertyOptional({
    description: 'Filter invitations by seen status',
    type: Boolean,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isSeen?: boolean;

  @ApiPropertyOptional({
    description: 'Filter invitations by followup sent status',
    type: Boolean,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  followupSent?: boolean;

  @ApiPropertyOptional({
    description: 'Filter invitations by thank you sent status',
    type: Boolean,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  thankYouSent?: boolean;

  @ApiPropertyOptional({
    description: 'Filter invitations by reply status (true = has replied, false = no reply)',
    type: Boolean,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  hasReplied?: boolean;

  @ApiPropertyOptional({
    description: 'Order invitations by ID',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class GetCampaignInvitationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by one or multiple invitation statuses',
    enum: InvitationStatus,
    isArray: true,
    example: ['sent', 'attended'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  @IsEnum(InvitationStatus, { each: true })
  status?: InvitationStatus[];

  @ApiPropertyOptional({
    description: 'Filter by seen status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  isSeen?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by follow-up sent status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  followupSent?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by thank-you sent status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  thankYouSent?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by reply status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  hasReplied?: boolean;

  @ApiPropertyOptional({
    description: 'Order invitations by invitation date',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';
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

