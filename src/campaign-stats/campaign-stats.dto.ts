import { ApiProperty } from '@nestjs/swagger';

export class BatchStatsDto {
  @ApiProperty({ description: 'Batch number' })
  batch: number;

  @ApiProperty({ description: 'Number of invites in this batch' })
  invites: number;

  @ApiProperty({
    description: 'Number of pending invites (invites - sent) in this batch',
  })
  pendingInvites: number;

  @ApiProperty({ description: 'Number of sent messages' })
  sent: number;

  @ApiProperty({ description: 'Number of delivered messages' })
  delivered: number;

  @ApiProperty({ description: 'Number of replies received' })
  replied: number;

  @ApiProperty({ description: 'Batch sent timestamp' })
  sentAt?: Date;

  @ApiProperty({
    description: 'Total time already spent sending this batch (in seconds, from first to last sent message)',
    required: false,
    nullable: true,
  })
  totalTimeSpentSeconds?: number | null;

  @ApiProperty({
    description: 'Estimated remaining time to complete sending this batch (in seconds, based on pending invitations)',
    required: false,
    nullable: true,
  })
  estimatedRemainingSeconds?: number | null;

  @ApiProperty({
    description: 'Estimated timestamp when sending for this batch will be completed',
    required: false,
    nullable: true,
  })
  estimatedCompletionAt?: Date | null;

  @ApiProperty({
    description: 'Expected total replies for this batch based on current reply rate',
    required: false,
    nullable: true,
  })
  expectedReplies?: number | null;
}

export class ResponseClassificationDto {
  @ApiProperty({ description: 'Number of confirmed responses' })
  confirmed: number;

  @ApiProperty({ description: 'Number of interested responses (maybe status)' })
  interested: number;

  @ApiProperty({ description: 'Number of declined responses' })
  declined: number;

  @ApiProperty({ description: 'Number of seen but no reply responses' })
  seenNoReply: number;
}

export class CampaignStatsDto {
  @ApiProperty({ description: 'Total profiles contacted' })
  totalContacted: number;

  @ApiProperty({ description: 'Total sent' })
  sent: number;

  @ApiProperty({ description: 'Total delivered' })
  delivered: number;

  @ApiProperty({ description: 'Total replied' })
  replied: number;

  @ApiProperty({ description: 'Response classification breakdown', type: ResponseClassificationDto })
  responseClassification: ResponseClassificationDto;

  @ApiProperty({ description: 'Batch statistics', type: [BatchStatsDto] })
  batches: BatchStatsDto[];
}

