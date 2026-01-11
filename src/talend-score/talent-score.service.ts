import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TalentScoreDto, TrustScoreLogDto, TalentPromoterStateDto } from './talent-score.dto';

@Injectable()
export class TalentScoreService {
  constructor(private prisma: PrismaService) {}

  async getTalentScore(
    talentId: number,
    promoterId: number,
  ): Promise<TalentScoreDto> {
    // Fetch the state for the talent-promoter pair
    const state = await this.prisma.talentPromoterState.findUnique({
      where: {
        talentId_promoterId: {
          talentId,
          promoterId,
        },
      },
    });

    // Fetch all trust score logs for the talent-promoter pair
    const logs = await this.prisma.trustScoreLog.findMany({
      where: {
        talentId,
        promoterId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      state: state
        ? {
            id: state.id,
            talentId: state.talentId,
            promoterId: state.promoterId,
            trustScore: state.trustScore,
            lastContacted: state.lastContacted,
            lastReply: state.lastReply,
            optedOut: state.optedOut,
          }
        : null,
      logs: logs.map((log) => ({
        id: log.id,
        talentId: log.talentId,
        promoterId: log.promoterId,
        eventId: log.eventId,
        change: log.change,
        reason: log.reason,
        createdAt: log.createdAt,
      })),
    };
  }
}

