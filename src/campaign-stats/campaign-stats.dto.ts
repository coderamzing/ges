import { ApiProperty } from '@nestjs/swagger';

export class BatchStatsDto {
  @ApiProperty({ description: 'Batch number' })
  batch: number;

  @ApiProperty({ description: 'Number of invites in this batch' })
  invites: number;

  @ApiProperty({ description: 'Number of sent messages' })
  sent: number;

  @ApiProperty({ description: 'Number of delivered messages' })
  delivered: number;

  @ApiProperty({ description: 'Number of replies received' })
  replied: number;

  @ApiProperty({ description: 'Batch sent timestamp' })
  sentAt?: Date;
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

