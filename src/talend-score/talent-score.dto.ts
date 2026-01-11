import { ApiProperty } from '@nestjs/swagger';

export class TrustScoreLogDto {
  @ApiProperty({ description: 'Log ID' })
  id: number;

  @ApiProperty({ description: 'Talent ID' })
  talentId: number;

  @ApiProperty({ description: 'Promoter ID' })
  promoterId: number;

  @ApiProperty({ description: 'Event ID (optional)', required: false, nullable: true })
  eventId: number | null;

  @ApiProperty({ description: 'Score change amount (e.g., +10, -5)' })
  change: number;

  @ApiProperty({ description: 'Reason for the change (e.g., positive_reply, no_reply_48h, attended)' })
  reason: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class TalentPromoterStateDto {
  @ApiProperty({ description: 'State ID' })
  id: number;

  @ApiProperty({ description: 'Talent ID' })
  talentId: number;

  @ApiProperty({ description: 'Promoter ID' })
  promoterId: number;

  @ApiProperty({ description: 'Current trust score' })
  trustScore: number;

  @ApiProperty({ description: 'Last contacted timestamp', required: false, nullable: true })
  lastContacted: Date | null;

  @ApiProperty({ description: 'Last reply timestamp', required: false, nullable: true })
  lastReply: Date | null;

  @ApiProperty({ description: 'Whether the talent has opted out' })
  optedOut: boolean;
}

export class TalentScoreDto {
  @ApiProperty({ description: 'Talent-promoter state', type: TalentPromoterStateDto, nullable: true })
  state: TalentPromoterStateDto | null;

  @ApiProperty({ description: 'Trust score logs', type: [TrustScoreLogDto] })
  logs: TrustScoreLogDto[];
}

