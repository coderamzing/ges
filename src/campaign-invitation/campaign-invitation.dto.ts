import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsInt, IsArray, IsNotEmpty, ArrayMinSize, IsNumber, IsString, ArrayNotEmpty, IsIn } from 'class-validator';
// import { InvitationStatus } from '@prisma/client';
import { InvitationStatus, type InvitationStatusType } from "src/campaign-invitation/campaign-invitation.config"
import { Transform, Type } from 'class-transformer';
import { MainEventType } from 'src/campaign-stats/campaign-stats.dto';




export class UpdateInvitationStatusDto {
  // @IsEnum(InvitationStatusType)
  status: InvitationStatusType;
}


export class DeleteInvitationResponseDto {
  @ApiProperty({ example: 'Invitation 42 deleted successfully' })
  message: string;
}


export class AddTalentsToEventDto {
  @ApiProperty({
    example: 101,
    description: 'Event ID',
  })
  @Type(() => Number)
  @IsNumber()
  eventId: number;

  // @ApiProperty({
  //   example: 202,
  //   description: 'Campaign ID',
  // })
  // @Type(() => Number)
  // @IsNumber()
  // campaignId: number;

  // @ApiProperty({
  //   example: 1,
  //   description: 'Batch ID',
  // })
  // @Type(() => Number)
  // @IsNumber()
  // batch: number;

  @ApiProperty({
    example: 'confirmed',
    description: 'Invitation status',
  })
  @IsString()
  status: string;

  @ApiProperty({
    type: [String],
    example: ['talent-id-1', 'talent-id-2'],
    description: 'List of talent IDs',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  talentIds: string[];
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
    type: String,
    isArray: true,
    example: ['sent', 'attended'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  @IsString({ each: true })
  status?: string[];


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
    type: String,
    isArray: true,
    example: ['sent', 'attended'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  @IsString({ each: true })
  status?: string[];

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

export class MarkInvitationNoShowDto {
  @IsInt()
  id: number;

  @IsInt()
  eventId: number;
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

export class UpdateInvitationEventTypeDto {
  @ApiProperty({
    enum: MainEventType,
    example: MainEventType.DINNER_CLUB,
  })
  @IsEnum(MainEventType, {
    message:
      'mainEventType must be one of: Dinner Only, Club Only, Dinner+Club, Pre-Drink+Club',
  })
  eventType: MainEventType;
}