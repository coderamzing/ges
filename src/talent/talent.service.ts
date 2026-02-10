import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TalentPool } from "@prisma/client";
import { TalentRecommendationFiltersDto } from "./talent.dto";
import { InvitationStatus } from "@prisma/client";
import { TP_STATUS_MAP } from "./talent.config";
import { BadRequestError } from "openai";
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



  async getDispatcherStatuses(type?: string) {
    if (!type) {
      throw new NotFoundException(`Must need type for filter.`);
    }
    // let value = type || process.env.DISPATCHER || 'dispatcher'
    const data = await this.prisma.tpStatus.findMany({
      where: {
        types: {
          contains: type,
        },
      },
    });

    const result = data.filter(item => {
      if (!item.types) return false;
      const typesArray = item.types.split(',').map(t => t.trim());
      return typesArray.includes(type);
    });

    return result;
  }


  async gettalentStatuses() {
    let value = process.env.TALENT || 'talent'
    const data = await this.prisma.tpStatus.findMany({
      where: {
        types: {
          contains: value,
        },
      },
    });

    const result = data.filter(item => {
      if (!item.types) return false;
      const typesArray = item.types.split(',').map(t => t.trim());
      return typesArray.includes(value);
    });

    return result;
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
    console.log(filters, "values ")
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


    baseWhere.AND ||= [];

    const filterFields = ["city", "country", "hairColor", "ethnicity"] as const;

    for (const field of filterFields) {
      const values = filters?.[field];

      if (!values || values.length === 0) continue;

      baseWhere.AND.push({
        [field]: {
          in: values,
          mode: "insensitive",
        },
      });
    }

    // search with recommendation

    const recommendation = filters.recommendation;
    const RecomendationCity = event?.city?.trim();
    const orderBy: any[] = [];

    if (recommendation) {
      baseWhere.OR = [
        {
          AND: [
            { futureCity: { not: null } },
            {
              futureCity: {
                equals: RecomendationCity,
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
                { currentCity: { equals: RecomendationCity, mode: "insensitive" } },
                { city: { equals: RecomendationCity, mode: "insensitive" } },
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
    if (filters.genre?.length) {
      baseWhere.talentType = { in: filters.genre };
    }

    // status filter
    const statusIds = (filters.statusId || [])
    const hasBlacklistFilter = statusIds.includes(TP_STATUS_MAP.BLACKLIST);

    if (!hasBlacklistFilter) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          NOT: {
            userTpStatus: {
              some: {
                userId: promoterId,
                statusId: TP_STATUS_MAP.BLACKLIST,
              },
            },
          },
        },
      ];
    }
    const normalStatusIds = statusIds.filter(id => id !== TP_STATUS_MAP.BLACKLIST);

    if (normalStatusIds.length > 0) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          userTpStatus: {
            some: {
              userId: promoterId,
              statusId: { in: normalStatusIds },
            },
          },
        },
      ];
    }

    if (hasBlacklistFilter) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          userTpStatus: {
            some: {
              userId: promoterId,
              statusId: TP_STATUS_MAP.BLACKLIST,
            },
          },
        },
      ];
    }


    //trust score with filter
    // ================= trust score filter (FINAL WORKING) =================
    if (filters.trustScoreRange) {
      const { min, max } = filters.trustScoreRange;

      const trustScoreCondition: any = {
        promoterId,
        optedOut: false,
      };

      if (min !== undefined) trustScoreCondition.trustScore = { gte: min };
      if (max !== undefined) {
        trustScoreCondition.trustScore = {
          ...(trustScoreCondition.trustScore || {}),
          lte: max,
        };
      }

      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          promoterStates: {
            some: trustScoreCondition,
          },
        },
      ];
    }


    // handle top 50 and top 100 logic here
    let topLimit: number | null = null;

    if (filters.top50) {
      topLimit = 50;
    } else if (filters.top100) {
      topLimit = 100;
    }
    console.log(topLimit, "trustc score")

    if (topLimit !== null) {
      const statusTalents = await this.prisma.userTpStatus.groupBy({
        by: ['talentPoolId'],
        where: {
          userId: BigInt(promoterId),
          statusId: {
            in: [TP_STATUS_MAP.FIRST_CHOICE, TP_STATUS_MAP.OPEN_CHAT],
          },
        },
        _count: {
          statusId: true,
        },
        having: {
          statusId: {
            _count: {
              equals: 2, // must have both statuses
            },
          },
        },
      });

      const statusTalentIds = statusTalents
        .map(s => s.talentPoolId)
        .filter((id): id is string => Boolean(id));

      const topTalents = await this.prisma.talentPromoterState.findMany({
        where: {
          promoterId: BigInt(promoterId),
          talentId: {
            in: statusTalentIds,
          }
        },
        orderBy: {
          trustScore: 'desc',
        },
        take: topLimit,
        select: {
          talentId: true,
        },
      });

      const finalTalentIds = topTalents.map(t => t.talentId);

      baseWhere.AND ||= [];
      baseWhere.AND.push({
        id: {
          in: finalTalentIds.length ? finalTalentIds : ["__none__"],
        },
      });
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
    const Templimit = filters.limit && filters.limit > 0 ? filters.limit : 100;

    const limit = recommendation ? 100 : topLimit !== null ? topLimit : Templimit > 0 ? Templimit : 100;
    console.log(limit, "final limit");

    const skip = (page - 1) * limit;

    // -------------------- total count --------------------
    const total = await this.prisma.talentPool.count({
      where: baseWhere,
    });

    // -------------------- fetch paginated data --------------------
    const data = await this.prisma.talentPool.findMany({
      where: baseWhere,
      skip,
      // take: limit,
      take: recommendation ? 100 : limit,
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

    const sortedData = data.sort((a, b) => {
      const trustScoreA = a.promoterStates?.[0]?.trustScore ?? 0;
      const trustScoreB = b.promoterStates?.[0]?.trustScore ?? 0;
      return trustScoreB - trustScoreA;
    });

    return {
      data: sortedData,
      total,
      page,
      limit,
      totalPages,
    };

  }

}
