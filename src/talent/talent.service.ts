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

    // for (const field of filterFields) {
    //   const value = filters?.[field];

    //   //  apply filter ONLY if value exists and is not empty
    //   if (value && typeof value === "string" && value.trim() !== "") {
    //     baseWhere.AND.push({
    //       [field]: {
    //         equals: value.trim(),
    //         mode: "insensitive",
    //       },
    //     });
    //   }
    // }


    // search with recommendation
    const statusIdForRecommendation = filters.statusId?.map(Number) || [];
    const recommendation = statusIdForRecommendation.includes(18);
    console.log(recommendation, "recomendation ")
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





    const BLACKLIST_STATUS_ID = 11;

    // status filter
    const statusIds = (filters.statusId || [])
      .map(Number)
      .filter(id => ![16, 17, 18].includes(id));

    const hasBlacklistFilter = statusIds.includes(BLACKLIST_STATUS_ID);


    console.log(hasBlacklistFilter, "incmoign blacklist number")

    if (!hasBlacklistFilter) {
      baseWhere.AND = [
        ...(baseWhere.AND || []),
        {
          NOT: {
            userTpStatus: {
              some: {
                userId: promoterId,
                statusId: BLACKLIST_STATUS_ID,
              },
            },
          },
        },
      ];
    }

    const normalStatusIds = statusIds.filter(id => id !== BLACKLIST_STATUS_ID);

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
              statusId: BLACKLIST_STATUS_ID,
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
    const defaultLimit = filters.limit && filters.limit > 0 ? filters.limit : 100;

    const statusList = filters.statusId?.map(Number) || [];
    const shouldSortByTrustScore = statusList.some(id => [16, 17, 18].includes(id));

    // dynamic limit logic
    let limit = defaultLimit;

    if (statusList.includes(16)) {
      limit = 50;
    } else if (statusList.includes(17) || statusList.includes(18)) {
      limit = 100;
    }

    const skip = (page - 1) * limit;

    // -------------------- total count --------------------
    const total = await this.prisma.talentPool.count({
      where: baseWhere,
    });

    let data: any[] = [];

    if (shouldSortByTrustScore) {
      const allData = await this.prisma.talentPool.findMany({
        where: baseWhere,
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

      const sortedData = allData.sort((a, b) => {
        const trustScoreA = a.promoterStates?.[0]?.trustScore ?? 0;
        const trustScoreB = b.promoterStates?.[0]?.trustScore ?? 0;
        return trustScoreB - trustScoreA;
      });

      data = sortedData.slice(skip, skip + limit);

    } else {
      data = await this.prisma.talentPool.findMany({
        where: baseWhere,
        skip,
        take: limit,
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
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
