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
    console.log(filters, "incoming filter data ")
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event ${campaign.eventId} not found`);
    }

    const promoterId = event.userId ? BigInt(event.userId) : null;
    if (!promoterId) {
      throw new NotFoundException(`Event has no promoter`);
    }
    const limit = filters.limit ?? 100;
    const baseWhere: any = {
      currentCity: event.city,
    };

    if (filters.talentType?.length) {
      baseWhere.talentType = {
        in: filters.talentType,
      };
    }

    const blacklistFilter = filters.blacklist === false
      ? { none: { promoterId } }
      : filters.blacklist === true
        ? { some: { promoterId } }
        : undefined;

    const hasTrustScoreFilter = !!filters.trustScoreRange;


    const shouldFilterPromoterState =
      filters.openchat !== undefined ||
      filters.dmSent !== undefined ||
      hasTrustScoreFilter;

    if (shouldFilterPromoterState) {

      baseWhere.OR = [
        {
          ...baseWhere,
          promoterStates: { none: { promoterId } },
          ...(blacklistFilter ? { blacklists: blacklistFilter } : {}),
        },

        {
          ...baseWhere,
          promoterStates: {
            some: {
              promoterId,
              optedOut: false,
              ...(filters.openchat === false ? { lastContacted: null } : {}),
              ...(filters.openchat === true ? { lastContacted: { not: null } } : {}),
              ...(filters.dmSent === false ? { lastReply: null } : {}),
              ...(filters.dmSent === true ? { lastReply: { not: null } } : {}),
              AND: [
                ...(filters.trustScoreRange?.min !== undefined
                  ? [{ trustScore: { gte: filters.trustScoreRange.min } }]
                  : []),
                ...(filters.trustScoreRange?.max !== undefined
                  ? [{ trustScore: { lte: filters.trustScoreRange.max } }]
                  : []),
              ],

            },
          },
          ...(blacklistFilter ? { blacklists: blacklistFilter } : {}),
        },
      ];

    } else if (blacklistFilter) {
      baseWhere.blacklists = blacklistFilter;
    }


    let excludedTalentIds: string[] = [];

    if (batchId === 1) {
      // Exclude anyone already invited in this campaign
      const invited = await this.prisma.campaignInvitation.findMany({
        where: {
          campaignId,
        },
        select: {
          talentId: true,
        },
      });

      excludedTalentIds = invited.map(i => i.talentId);
    }
    // const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    // const oneHourAgo = new Date(Date.now() - 2 * 60 * 1000);



    if (batchId === 2) {
      // Exclude anyone invited in batch 1
      const invitedBatchOne = await this.prisma.campaignInvitation.findMany({
        where: {
          campaignId,
          batch: 1,
          // invitationAt: {
          //   gt: oneHourAgo, // invited less than 1 hour ago
          // },
        },
        select: {
          talentId: true,
        },
      });

      excludedTalentIds = invitedBatchOne.map(i => i.talentId);
    }

    if (excludedTalentIds.length > 0) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          id: { notIn: excludedTalentIds },
        },
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
      orderBy: {
        followers: 'desc',
      },
      take: limit,
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


  // async getRecommendations(
  //   campaignId: number,
  //   batchId: number,
  //   filters: TalentRecommendationFiltersDto,
  // ): Promise<any[]> {

  //   const campaign = await this.prisma.campaign.findUnique({
  //     where: { id: campaignId },
  //   });
  //   if (!campaign) {
  //     throw new NotFoundException(`Campaign ${campaignId} not found`);
  //   }

  //   const event = await this.prisma.events.findUnique({
  //     where: { id: campaign.eventId },
  //   });
  //   if (!event) {
  //     throw new NotFoundException(`Event ${campaign.eventId} not found`);
  //   }

  //   const promoterId = event.userId ? BigInt(event.userId) : null;
  //   if (!promoterId) {
  //     throw new NotFoundException(`Event has no promoter`);
  //   }

  //   const limit = filters.limit ?? 100;

  //   const where: any = {
  //     currentCity: event.city,
  //   };

  //   if (filters.talentType?.length) {
  //     where.talentType = {
  //       in: filters.talentType,
  //     };
  //   }

  //   // ---------------- BLACKLIST ----------------
  //   if (filters.blacklist === true) {
  //     where.blacklists = { some: { promoterId } };
  //   } else if (filters.blacklist === false) {
  //     where.blacklists = { none: { promoterId } };
  //   }

  //   // ---------------- PROMOTER STATE LOGIC ----------------
  //   const hasPromoterFilters =
  //     filters.openchat !== undefined ||
  //     filters.dmSent !== undefined ||
  //     filters.trustScoreMin !== undefined ||
  //     filters.trustScoreMax !== undefined;

  //   if (hasPromoterFilters) {
  //     const promoterStateFilter: any = {
  //       promoterId,
  //       optedOut: false,
  //     };

  //     // open chat
  //     if (filters.openchat === true) {
  //       promoterStateFilter.lastContacted = { not: null };
  //     } else if (filters.openchat === false) {
  //       promoterStateFilter.lastContacted = null;
  //     }

  //     // dm sent
  //     if (filters.dmSent === true) {
  //       promoterStateFilter.lastReply = { not: null };
  //     } else if (filters.dmSent === false) {
  //       promoterStateFilter.lastReply = null;
  //     }

  //     // trust score
  //     const trustScore: any = {};
  //     if (filters.trustScoreMin !== undefined && filters.trustScoreMin > 0) {
  //       trustScore.gte = filters.trustScoreMin;
  //     }
  //     if (filters.trustScoreMax !== undefined) {
  //       trustScore.lte = filters.trustScoreMax;
  //     }
  //     if (Object.keys(trustScore).length > 0) {
  //       promoterStateFilter.trustScore = trustScore;
  //     }

  //     // ❗IMPORTANT: once any filter is active → promoterState MUST exist
  //     where.promoterStates = {
  //       some: promoterStateFilter,
  //     };
  //   }
  //   // else → NO promoter filter → promoterState null is allowed

  //   const talentPools = await this.prisma.talentPool.findMany({
  //     where,
  //     include: {
  //       promoterStates: {
  //         where: { promoterId },
  //         take: 1,
  //       },
  //       blacklists: {
  //         where: { promoterId },
  //         take: 1,
  //       },
  //     },
  //     take: limit,
  //   });

  //   return talentPools.map((talent: any) => {
  //     const promoterState = talent.promoterStates?.[0] || null;
  //     const blacklist = talent.blacklists?.[0] || null;

  //     const { promoterStates, blacklists, ...data } = talent;

  //     return {
  //       ...data,
  //       promoterState,
  //       blacklist,
  //     };
  //   });
  // }





  // async getRecommendations(
  //   campaignId: number,
  //   batchId: number,
  //   filters: TalentRecommendationFiltersDto,
  // ): Promise<any[]> {

  //   const campaign = await this.prisma.campaign.findUnique({
  //     where: { id: campaignId },
  //   });
  //   if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

  //   const event = await this.prisma.events.findUnique({
  //     where: { id: campaign.eventId },
  //   });
  //   if (!event) throw new NotFoundException(`Event ${campaign.eventId} not found`);

  //   const promoterId = event.userId ? BigInt(event.userId) : null;
  //   if (!promoterId) throw new NotFoundException(`Event has no promoter`);

  //   const limit = filters.limit ?? 100;

  //   const promoterFilters: any[] = [];


  //   if (filters.openchat !== undefined) {
  //     promoterFilters.push(
  //       filters.openchat
  //         ? { lastContacted: { not: null } }
  //         : { lastContacted: null }
  //     );
  //   }
  //   if (filters.dmSent !== undefined) {
  //     promoterFilters.push(
  //       filters.dmSent
  //         ? { lastReply: { not: null } }
  //         : { lastReply: null }
  //     );
  //   }

  //   if ((filters.trustScoreMin ?? 0) > 0 || filters.trustScoreMax !== undefined) {
  //     const trustScoreFilter: any = {};
  //     if (filters.trustScoreMin !== undefined && filters.trustScoreMin > 0) {
  //       trustScoreFilter.gte = filters.trustScoreMin;
  //     }
  //     if (filters.trustScoreMax !== undefined) {
  //       trustScoreFilter.lte = filters.trustScoreMax;
  //     }
  //     if (Object.keys(trustScoreFilter).length > 0) {
  //       promoterFilters.push({ trustScore: trustScoreFilter });
  //     }
  //   }

  //   const where: any = {
  //     currentCity: event.city,
  //   };

  //   if (filters.talentType?.length) {
  //     where.talentType = {
  //       in: filters.talentType
  //     };
  //   }

  //   if (filters.blacklist === true) {
  //     where.blacklists = { some: { promoterId } };
  //   } else if (filters.blacklist === false) {
  //     where.blacklists = { none: { promoterId } };
  //   }

  //   if (filters.openchat === false) {
  //     where.promoterStates = {
  //       none: { promoterId },
  //     };
  //   }
  //   else if (promoterFilters.length > 0) {
  //     where.promoterStates = {
  //       some: {
  //         promoterId,
  //         optedOut: false,
  //         AND: promoterFilters,   
  //       },
  //     };
  //   }

  //   const talentPools = await this.prisma.talentPool.findMany({
  //     where,
  //     include: {
  //       promoterStates: {
  //         where: { promoterId },
  //         take: 1,
  //       },
  //       blacklists: {
  //         where: { promoterId },
  //         take: 1,
  //       },
  //     },
  //     take: limit,
  //     orderBy: {
  //       followers: 'desc'
  //     },
  //   });

  //   return talentPools.map((talent: any) => {
  //     const promoterState = talent.promoterStates?.[0] || null;
  //     const blacklist = talent.blacklists?.[0] || null;
  //     const { promoterStates, blacklists, ...data } = talent;

  //     return {
  //       ...data,
  //       promoterState,
  //       blacklist,
  //     };
  //   });
  // }


















}

