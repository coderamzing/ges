import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TalentPool, TalentPromoterState } from '@prisma/client';
import { TalentRecommendationFiltersDto } from './talent.dto';

@Injectable()
export class TalentService {
  constructor(private prisma: PrismaService) {}
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
  ): Promise<(TalentPool & { promoterState?: TalentPromoterState | null; isBlacklisted?: boolean })[]> {
    // Get campaign and event to find promoterId
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${campaign.eventId} not found`);
    }

    const promoterId = event.userId ? BigInt(event.userId) : null;
    if (!promoterId) {
      throw new NotFoundException(`Event with ID ${campaign.eventId} has no associated user`);
    }
    const limit = filters.limit || 100;

    // Query TalentPool with relations using include
    // This fetches TalentPromoterState and TalentBlacklist in a single query
    const talentPools = await (this.prisma as any).talentPool.findMany({
      where: {
        // All talents now have string IDs
        promoterStates: {
          none: {
            promoterId: promoterId,
            optedOut: true, // Exclude opted-out
          },
        },
        blacklists: {
          none: {
            promoterId: promoterId, // Exclude blacklisted
          },
        },
      },
      include: {
        promoterStates: {
          where: {
            promoterId: promoterId,
          },
          take: 1, // Only get the state for this promoter
        },
        blacklists: {
          where: {
            promoterId: promoterId,
          },
          take: 1, // Only check if blacklisted for this promoter
        },
      },
      take: limit,
      orderBy: { followers: 'desc' },
    });

    // Transform results to match expected format
    return talentPools.map((talentPool: any) => {
      const promoterState = talentPool.promoterStates?.[0] || null;
      const isBlacklisted = talentPool.blacklists?.length > 0;

      // Remove the relations arrays from the result
      const { promoterStates, blacklists, ...talentPoolData } = talentPool;

      return {
        ...talentPoolData,
        promoterState,
        isBlacklisted,
      };
    });
  }
}

