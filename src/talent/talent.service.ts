import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TalentPool } from "@prisma/client";
import { TalentRecommendationFiltersDto } from "./talent.dto";
import { InvitationStatus } from "@prisma/client";
import { TP_STATUS_MAP } from "./talent.config";
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
  ): Promise<{
    data: TalentPool[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign)
      throw new NotFoundException(`Campaign ${campaignId} not found`);

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event)
      throw new NotFoundException(`Event ${campaign.eventId} not found`);

    const promoterId = event.userId ? BigInt(event.userId) : null;
    if (!promoterId) throw new NotFoundException(`Event has no promoter`);

    // 48 hours rule

    const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

    const hiddenTalents48h = await this.prisma.campaignInvitation.findMany({
      where: {
        promoterId: promoterId,
        status: "sent",
        invitationAt: {
          not: null,
          gte: cutoffDate,
        },
      },
      select: {
        talentId: true,
      },
      distinct: ["talentId"],
    });
    const hidden48 = hiddenTalents48h.map((t) => t.talentId);

    if (!event.dt)
      throw new NotFoundException(`Event ${campaign.eventId} not found`);

    const startOfDay = new Date(event.dt);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(event.dt);
    endOfDay.setHours(23, 59, 59, 999);

    // fetch same days events
    const eventIds = await this.prisma.events.findMany({
      where: {
        dt: {
          not: null,
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: { id: true },
    });

    // fetch talent those accept invitation for other event on same date .
    const acceptedInvitations = await this.prisma.campaignInvitation.findMany({
      where: {
        status: "confirmed",
        eventId: {
          in: eventIds.map((e) => Number(e.id)),
        },
      },
      select: {
        talentId: true,
      },
      distinct: ["talentId"],
    });

    const acceptedTalentIds = acceptedInvitations.map((i) => i.talentId);

    // filter  condtions
    const baseWhere: any = {};

    //exclude 48 hours talents
    if (hidden48.length) {
      baseWhere.AND = [...(baseWhere.AND || []), { id: { notIn: hidden48 } }];
    }

    // exclude those accept the invitation of other event on same date
    if (acceptedTalentIds.length) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          id: { notIn: acceptedTalentIds },
        },
      ];
    }

    // with  search
    if (filters.search && filters.search.trim().length > 0) {
      const q = filters.search.trim();

      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          OR: [
            {
              id: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              name: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              city: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        },
      ];
    }

    const city = filters?.city ? filters?.city?.trim() : event.city?.trim();
    console.log(city, "incoming vity ");
    if (city) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          city: {
            equals: city,
            mode: "insensitive",
          },
        },
      ];
    }
    // search with recommendation
    const orderBy: any[] = [];

    if (filters.recommendation === true) {
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
            {
              OR: [
                { futureCity: null },
                {
                  NOT: {
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
                },
              ],
            },
            {
              OR: [
                { currentCity: { equals: city, mode: "insensitive" } },
                { city: { equals: city, mode: "insensitive" } },
              ],
            },
          ],
        },
      ];
      orderBy.push(
        {
          futureCity: {
            sort: "asc",
            nulls: "last",
          },
        },
        {
          futureCityStartAt: {
            sort: "asc",
            nulls: "last",
          },
        },
      );
    }

    // search with talent type
    if (filters.talentType?.length) {
      baseWhere.talentType = { in: filters.talentType };
    }

    // search with Open Chat , Dm Sent , First Choice , Liked
    const statusFilters = [
      { enabled: filters.openchat === true, id: TP_STATUS_MAP.OPEN_CHAT },
      { enabled: filters.dmSent === true, id: TP_STATUS_MAP.DM_SENT },
      { enabled: filters.firstChoice === true, id: TP_STATUS_MAP.FIRST_CHOICE },
      { enabled: filters.liked === true, id: TP_STATUS_MAP.LIKED },
      { enabled: filters.blacklist === true, id: TP_STATUS_MAP.BLACKLIST },
    ];

    const enabledStatuses = statusFilters.filter((s) => s.enabled);

    if (enabledStatuses.length > 0) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        ...enabledStatuses.map((status) => ({
          userTpStatus: {
            some: {
              userId: promoterId,
              statusId: status.id,
            },
          },
        })),
      ];
    }

    //trust score with filter
    const hasTrustScoreFilter =
      filters.trustScoreRange !== undefined &&
      ((filters.trustScoreRange.min !== undefined &&
        filters.trustScoreRange.min > 0) ||
        filters.trustScoreRange.max !== undefined);

    if (hasTrustScoreFilter) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          promoterStates: {
            some: {
              promoterId,
              optedOut: false,

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

    // -------- Exclusions by batch --------
    let excludedTalentIds: string[] = [];
    const invited = await this.prisma.campaignInvitation.findMany({
      where: { campaignId },
      select: { talentId: true },
    });
    excludedTalentIds = invited.map((i) => i.talentId);
    if (excludedTalentIds.length) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        { id: { notIn: excludedTalentIds } },
      ];
    }


    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 100;
    const skip = (page - 1) * limit;

    // -------------------- orderBy (NO trustScore sorting now) --------------------


    // -------------------- total count --------------------
    const total = await this.prisma.talentPool.count({
      where: baseWhere,
    });

    // -------------------- fetch paginated data --------------------
    const data = await this.prisma.talentPool.findMany({
      where: baseWhere,
      skip,
      take: limit,
      // orderBy,
      include: {
        blacklists: { where: { promoterId }, take: 1 },
        promoterStates: {
          where: { promoterId },
          take: 1,
          select: { trustScore: true },
        },
        userTpStatus: {
          where: { userId: promoterId },
          select: {
            id: true,
            statusId: true,
            statusName: true,
            createdAt: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };


    //   const page = filters.page && filters.page > 0 ? filters.page : 1;
    //   const limit = filters.limit && filters.limit > 0 ? filters.limit : 100;

    //   const limitPerChunk = 5000; // safe chunk size
    //   let offset = 0;
    //   let allTalents: any[] = [];

    //   while (true) {
    //     const chunk = await this.prisma.talentPool.findMany({
    //       skip: offset,
    //       take: limitPerChunk,
    //       where: baseWhere,
    //       include: {
    //         blacklists: { where: { promoterId }, take: 1 },
    //         promoterStates: {
    //           where: { promoterId },
    //           take: 1,
    //           select: { trustScore: true },
    //         },
    //       },
    //     });

    //     if (chunk.length === 0) break;

    //     allTalents.push(...chunk);
    //     offset += limitPerChunk;
    //   }

    //   // Map trustScore = 0 if missing and sort
    //   const rankedTalents = allTalents
    //     .map((tp) => ({
    //       ...tp,
    //       trustScore: tp.promoterStates[0]?.trustScore ?? 0,
    //     }))
    //     .sort((a, b) => b.trustScore - a.trustScore);

    //   //  total count AFTER all filters
    //   const totalCount = rankedTalents.length;

    //   //  pagination calculation
    //   const totalPages = Math.ceil(totalCount / limit);
    //   const startIndex = (page - 1) * limit;
    //   const paginatedTalents = rankedTalents.slice(
    //     startIndex,
    //     startIndex + limit,
    //   );

    //   return {
    //     total: totalCount,
    //     page,
    //     limit,
    //     totalPages,
    //     data: paginatedTalents,
    //   };
  }
}
