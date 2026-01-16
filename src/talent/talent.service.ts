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

  // async getRecommendations(
  //   campaignId: number,
  //   batchId: number,
  //   filters: TalentRecommendationFiltersDto,
  // ): Promise<(TalentPool & { promoterState?: TalentPromoterState | null; isBlacklisted?: boolean })[]> {
  //   // Get campaign and event to find promoterId
  //   const campaign = await this.prisma.campaign.findUnique({
  //     where: { id: campaignId },
  //   });

  //   if (!campaign) {
  //     throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
  //   }

  //   const event = await this.prisma.events.findUnique({
  //     where: { id: campaign.eventId },
  //   });

  //   if (!event) {
  //     throw new NotFoundException(`Event with ID ${campaign.eventId} not found`);
  //   }

  //   const promoterId = event.userId ? BigInt(event.userId) : null;
  //   if (!promoterId) {
  //     throw new NotFoundException(`Event with ID ${campaign.eventId} has no associated user`);
  //   }
  //   const limit = filters.limit || 100;

  //   // Query TalentPool with relations using include
  //   // This fetches TalentPromoterState and TalentBlacklist in a single query
  //   const talentPools = await (this.prisma as any).talentPool.findMany({
  //     where: {
  //       // All talents now have string IDs
  //       promoterStates: {
  //         none: {
  //           promoterId: promoterId,
  //           optedOut: true, // Exclude opted-out
  //         },
  //       },
  //       blacklists: {
  //         none: {
  //           promoterId: promoterId, // Exclude blacklisted
  //         },
  //       },
  //     },
  //     include: {
  //       promoterStates: {
  //         where: {
  //           promoterId: promoterId,
  //         },
  //         take: 1, // Only get the state for this promoter
  //       },
  //       blacklists: {
  //         where: {
  //           promoterId: promoterId,
  //         },
  //         take: 1, // Only check if blacklisted for this promoter
  //       },
  //     },
  //     take: limit,
  //     orderBy: { followers: 'desc' },
  //   });

  //   // Transform results to match expected format
  //   return talentPools.map((talentPool: any) => {
  //     const promoterState = talentPool.promoterStates?.[0] || null;
  //     const isBlacklisted = talentPool.blacklists?.length > 0;

  //     // Remove the relations arrays from the result
  //     const { promoterStates, blacklists, ...talentPoolData } = talentPool;

  //     return {
  //       ...talentPoolData,
  //       promoterState,
  //       isBlacklisted,
  //     };
  //   });
  // }







  async getRecommendations(
    campaignId: number,
    batchId: number,
    filters: TalentRecommendationFiltersDto,
  ): Promise<any[]> {
    console.log(filters, "incoming filters");

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

    const promoterFilters: any[] = [];


    if (filters.openchat !== undefined) {
      promoterFilters.push(
        filters.openchat
          ? { lastContacted: { not: null } }
          : { lastContacted: null }
      );
    }


    if (filters.dmSent !== undefined) {
      promoterFilters.push(
        filters.dmSent
          ? { lastReply: { not: null } }
          : { lastReply: null }
      );
    }


    if ((filters.trustScoreMin ?? 0) > 0 || filters.trustScoreMax !== undefined) {
      const trustScoreFilter: any = {};
      if (filters.trustScoreMin !== undefined && filters.trustScoreMin > 0) {
        trustScoreFilter.gte = filters.trustScoreMin;
      }
      if (filters.trustScoreMax !== undefined) {
        trustScoreFilter.lte = filters.trustScoreMax;
      }
      if (Object.keys(trustScoreFilter).length > 0) {
        promoterFilters.push({ trustScore: trustScoreFilter });
      }
    }


    const where: any = {
      currentCity: event.city,
    };

    console.log("where", where)

    if (filters.talentType?.length) {
      where.talentType = {
        in: filters.talentType
      };
    }

    if (filters.blacklist === true) {
      where.blacklists = { some: { promoterId } };
    } else if (filters.blacklist === false) {
      where.blacklists = { none: { promoterId } };
    }

    if (promoterFilters.length > 0) {
      where.OR = [
        // CASE 1: talents WITH promoterState that match filters
        {
          promoterStates: {
            some: {
              promoterId,
              optedOut: false,
              OR: promoterFilters,
            },
          },
        },

        // ✅ CASE 2: talents with NO promoterState for this promoter
        {
          promoterStates: {
            none: { promoterId },
          },
        },
      ];
    }
    else if (filters.trustScoreMin === 0) {
      where.promoterStates = {
        none: { promoterId },
      };
    }

    const talentPools = await this.prisma.talentPool.findMany({
      where,
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
      take: limit,
      orderBy: {
        followers: 'desc'
      },
    });

    return talentPools.map((talent: any) => {
      const promoterState = talent.promoterStates?.[0] || null;
      const blacklist = talent.blacklists?.[0] || null;
      const { promoterStates, blacklists, ...data } = talent;

      return {
        ...data,
        promoterState,
        blacklist,
      };
    });
  }


















}

