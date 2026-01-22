import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TalentPool, TalentPromoterState } from '@prisma/client';
import { TalentRecommendationFiltersDto } from './talent.dto';

@Injectable()
export class TalentService {
  constructor(private prisma: PrismaService) { }
  async findOne(id: string): Promise<TalentPool> {
    const talent = await this.prisma.talentPool.findUnique({
      where: { id },
    });

    if (!talent) {
      throw new NotFoundException(`Talent with ID ${id} not found`);
    }

    return talent;
  }



  async getRecommendations(
    campaignId: number,
    batchId: number,
    filters: TalentRecommendationFiltersDto,
  ): Promise<any[]> {

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });
    if (!event) throw new NotFoundException(`Event ${campaign.eventId} not found`);

    const promoterId = event.userId ? BigInt(event.userId) : null;
    if (!promoterId) throw new NotFoundException(`Event has no promoter`);

    const limit = filters.limit ?? 100;

    // const baseWhere: any = {
    //   OR: [
    //     { currentCity: event.city },
    //     { city: event.city },
    //   ],
    // };

    const baseWhere: any = {}
    if (filters.recommendation === true) {
      baseWhere.OR = [
        { currentCity: event.city },
        { city: event.city },
      ];
    }

    if (filters.talentType?.length) {
      baseWhere.talentType = { in: filters.talentType };
    }

    const blacklistFilter =
      filters.blacklist === false
        ? { none: { promoterId } }
        : filters.blacklist === true
          ? { some: { promoterId } }
          : undefined;

    const hasTrustScoreFilter = !!filters.trustScoreRange;
    const hasOpenChatFilter = filters.openchat === true;
    const hasDmSentFilter = filters.dmSent === true;

    const shouldFilterPromoterState =
      hasOpenChatFilter || hasDmSentFilter || hasTrustScoreFilter;

    if (shouldFilterPromoterState) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          promoterStates: {
            some: {
              promoterId,
              optedOut: false,

              ...(hasOpenChatFilter
                ? { lastContacted: { not: null } }
                : {}),

              ...(hasDmSentFilter
                ? { lastReply: { not: null } }
                : {}),

              ...(hasTrustScoreFilter
                ? {
                  AND: [
                    ...(filters.trustScoreRange?.min !== undefined
                      ? [{ trustScore: { gte: filters.trustScoreRange.min } }]
                      : []),
                    ...(filters.trustScoreRange?.max !== undefined
                      ? [{ trustScore: { lte: filters.trustScoreRange.max } }]
                      : []),
                  ],
                }
                : {}),
            },
          },
        },
      ];
    }

    if (blacklistFilter) {
      baseWhere.blacklists = blacklistFilter;
    }

    // -------- Exclusions by batch --------
    let excludedTalentIds: string[] = [];

    if (batchId === 1) {
      const invited = await this.prisma.campaignInvitation.findMany({
        where: { campaignId },
        select: { talentId: true },
      });
      excludedTalentIds = invited.map(i => i.talentId);
    }

    if (batchId === 2) {
      const invitedBatchOne = await this.prisma.campaignInvitation.findMany({
        where: { campaignId, batch: 1 },
        select: { talentId: true },
      });
      excludedTalentIds = invitedBatchOne.map(i => i.talentId);
    }

    if (excludedTalentIds.length) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        { id: { notIn: excludedTalentIds } },
      ];
    }

    const talentPools = await this.prisma.talentPool.findMany({
      where: baseWhere,
      include: {
        promoterStates: {
          where: { promoterId },
          take: 1,
        },
        blacklists: {
          where: { promoterId },
          take: 1,
        },
      },
      orderBy: { followers: 'desc' },
      take: limit,
    });

    return talentPools.map(talent => {
      const promoterState = talent.promoterStates?.[0] ?? null;
      const blacklist = talent.blacklists?.[0] ?? null;
      const { promoterStates, blacklists, ...data } = talent;
      return { ...data, promoterState, blacklist };
    });
  }





















}

