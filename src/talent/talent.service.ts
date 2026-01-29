import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TalentPool } from "@prisma/client";
import { TalentRecommendationFiltersDto } from "./talent.dto";
import { InvitationStatus } from "@prisma/client";

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
    promoterId: number,
  ): Promise<(TalentPool & { promoterState?: any | null })[]> {
    const promoterIdBigInt = BigInt(promoterId);

    const {
      query,
      openchat,
      dmSent,
      blacklist,
      talentType,
      trustScoreRange,
      recommendation,
      limit = 100,
    } = filters || {};

    let rejectTalentIds: string[] = [];

    // Ensure campaign exists (and load event for recommendation logic)
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
      throw new NotFoundException(
        `Event with ID ${campaign.eventId} not found`,
      );
    }

    // Exclude talents that have an invitation in this campaign in the last 48h
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentUnrepliedInvitations =
      await this.prisma.campaignInvitation.findMany({
        where: {
          OR: [
            { campaignId },
            {
              invitationAt: {
                gt: fortyEightHoursAgo,
              },
            },
          ],
        },
        select: { talentId: true },
      });
    const invitedTalentIds = recentUnrepliedInvitations.map((i) => i.talentId);
    rejectTalentIds.push(...invitedTalentIds);


    //ignore talent which are already accepted inviation on same dat with another promoter
    const alreadyAcceptedInviteOnSameDay = await this.prisma.campaignInvitation.findMany({
      where: {
        status: {
          equals: InvitationStatus.confirmed,
        },
        event: {
          dt: event.dt,
        },
      },
      select: {
        talentId: true,
      },
    });
    rejectTalentIds.push(...alreadyAcceptedInviteOnSameDay.map((i) => i.talentId));

    const baseWhere: any = {};
    const promoterStateConditions: any = {
      promoterId: promoterIdBigInt,
    };

    // If openchat is true, only include talents that have been contacted before
    if (openchat === true) {
      promoterStateConditions.lastContacted = { not: null };
    } else if (openchat === false) {
      promoterStateConditions.lastContacted = null;
    }

    // If dmSent is true, only include talents that have replied before
    if (dmSent === true) {
      promoterStateConditions.lastReply = { not: null };
    } else if (dmSent === false) {
      promoterStateConditions.lastReply = null;
    }

    // If blacklist is true, only include talents that are not blacklisted
    if (blacklist === true) {
      baseWhere.blacklists = {
        some: { promoterId: promoterIdBigInt },
      };
    } else if (blacklist === false) {
      baseWhere.blacklists = {
        none: { promoterId: promoterIdBigInt },
      };
    }


    // Talent type filter
    if (talentType && Array.isArray(talentType) && talentType.length > 0) {
      baseWhere.talentType = { in: talentType };
    }

    //TRUSTSCORE
    if (trustScoreRange?.min !== undefined) {
      promoterStateConditions.trustScore = {
        gte: trustScoreRange.min,
        ...(trustScoreRange.max !== undefined
          ? { lte: trustScoreRange.max }
          : {}),
      };
    }

    // Text search on username (id), name, and city_home
    if (query && query.trim().length > 0) {
      const q = query.trim();
      baseWhere.AND = [
        { OR: [
          { id: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { cityHome: { contains: q, mode: "insensitive" } },
        ]}
      ];
    }

    //append promoterStateConditions to baseWhere if it has more than 1 key
    if (Object.keys(promoterStateConditions).length > 1) {
      baseWhere.promoterStates = {
        some: promoterStateConditions,
      };
    }

    //recommendation
    if(recommendation === true) {
      const city = event.city?.trim();
      baseWhere.blacklists = {
        none: { promoterId: promoterIdBigInt },
      };
      baseWhere.OR = [
        {
          AND: [
            { futureCity: { not: null } },
            {
              futureCity: {
                equals: city,
                mode: "insensitive",
              },
            },
            {
              OR: [
                {
                  AND: [{ futureCityStartAt: null }, { futureCityEndAt: null }],
                },
                {
                  AND: [
                    { futureCityStartAt: { lte: event.dt } },
                    {
                      OR: [
                        { futureCityEndAt: { gte: event.dt } },
                        { futureCityEndAt: null },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        //  Only use currentCity if futureCity is null
        {
          AND: [
            { futureCity: null },
            {
              currentCity: {
                equals: city,
                mode: "insensitive",
              },
            },
          ],
        },
        //  Only use city if futureCity is null
        {
          AND: [
            { futureCity: null },
            {
              city: {
                equals: city,
                mode: "insensitive",
              },
            },
          ],
        },
      ];
    }


    if (rejectTalentIds.length > 0) {
      baseWhere.id = { notIn: rejectTalentIds };
    }

    //orderBY
    const orderBy: any[] = [
      // { futureCityEndAt: "desc" },
      // { currentCityEndAt: "desc" },
      //{ trustScore: "asc" }
    ];

    // console.log(openchat, dmSent, blacklist);
    // console.log(JSON.stringify(baseWhere, null, 2));


    const talentPools = await this.prisma.talentPool.findMany({
      where: baseWhere,
      include: {
        promoterStates: {
          where: { promoterId: promoterIdBigInt },
          orderBy: { trustScore: 'desc' },
          take: 1,
        },
        blacklists: {
          where: { promoterId: promoterIdBigInt },
        },
      },
      orderBy: [
        { futureCityStartAt: 'asc' },
        { currentCityEndAt: 'asc' },
        {
          promoterStates: {
            _count: 'asc'
          }
        },
      ],
      take: limit,
    });

    return talentPools;
  }
}
