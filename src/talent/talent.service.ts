import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TalentPool } from "@prisma/client";
import { TalentRecommendationFiltersDto } from "./talent.dto";
// import { InvitationStatus } from "@prisma/client";
import { InvitationStatus, type InvitationStatusType } from "src/campaign-invitation/campaign-invitation.config"
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

  // async getDispatcherStatuses(type?: string) {
  //   if (!type) {
  //     throw new NotFoundException(`Must need type for filter.`);
  //   }
  //   // let value = type || process.env.DISPATCHER || 'dispatcher'
  //   const data = await this.prisma.tpStatus.findMany({
  //     where: {
  //       types: {
  //         contains: type,
  //       },
  //     },
  //   });

  //   const result = data.filter(item => {
  //     if (!item.types) return false;
  //     const typesArray = item.types.split(',').map(t => t.trim());
  //     return typesArray.includes(type);
  //   });

  //   return result;
  // }

  // async gettalentStatuses() {
  //   let value = process.env.TALENT || 'talent'
  //   const data = await this.prisma.tpStatus.findMany({
  //     where: {
  //       types: {
  //         contains: value,
  //       },
  //     },
  //   });

  //   const result = data.filter(item => {
  //     if (!item.types) return false;
  //     const typesArray = item.types.split(',').map(t => t.trim());
  //     return typesArray.includes(value);
  //   });

  //   return result;
  // }

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
    console.log(filters, "values ");
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
    const responseAccumulator = new Map<string, number[]>();

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
                {
                  currentCity: {
                    equals: RecomendationCity,
                    mode: "insensitive",
                  },
                },
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

      const invitationsWithMessages =
        await this.prisma.campaignInvitation.findMany({
          where: {
            promoterId,
            thread_id: { not: null },
          },
          select: {
            talentId: true,
            thread_id: true,
            messages: {
              where: {
                tm: { not: null },
              },
              select: {
                sender: true,
                tm: true,
                sender_username: true,
              },
              orderBy: {
                tm: "asc",
              },
            },
          },
        });

      const threadIds = invitationsWithMessages
        .map((i) => i.thread_id)
        .filter((id): id is string => id !== null);

      const threads = await this.prisma.thread.findMany({
        where: {
          id: { in: threadIds },
        },
        select: {
          id: true,
          username1: true,
          username2: true,
        },
      });

      const threadMap = new Map(threads.map((t) => [t.id, t]));
      for (const inv of invitationsWithMessages) {
        if (!inv.thread_id) continue;

        const thread = threadMap.get(inv.thread_id);
        if (!thread) continue;

        const { username1: promoterUsername, username2: talentUsername } =
          thread;

        const messages = inv.messages;

        for (let i = 0; i < messages.length - 1; i++) {
          const current = messages[i];
          const next = messages[i + 1];
          if (
            current.sender_username === promoterUsername &&
            next.sender_username === talentUsername
          ) {
            const diffSeconds =
              (next.tm!.getTime() - current.tm!.getTime()) / 1000;

            if (!responseAccumulator.has(inv.talentId)) {
              responseAccumulator.set(inv.talentId, []);
            }

            responseAccumulator.get(inv.talentId)!.push(diffSeconds);
          }
        }
      }
    }

    // search with talent type
    if (filters.genre?.length) {
      baseWhere.genre = { in: filters.genre };
    }

    // status filter
    const statusIds = filters.statusId || [];
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
    const normalStatusIds = statusIds.filter(
      (id) => id !== TP_STATUS_MAP.BLACKLIST,
    );

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
    // logic to groupBY by talent Type
    const defaultPriority: Record<string, number> = {
      supermodel: 1,
      model: 2,
      hybrid: 3,
      civilian: 4,
    };

    let profilePriority: Record<string, number>;

    if (filters.genre?.length) {
      profilePriority = Object.fromEntries(
        Object.entries(defaultPriority).filter(([type]) =>
          filters.genre!.includes(type),
        ),
      );
    } else {
      profilePriority = defaultPriority;
    }

    // handle top N logic here
    const topLimit = filters.top ?? null;
    console.log(topLimit, "trustc score");
    console.log(promoterId, "incoming promoter id ");
    if (topLimit && topLimit > 0) {
      const statusTalents = await this.prisma.userTpStatus.groupBy({
        by: ["talentPoolId"],
        where: {
          userId: BigInt(promoterId),
          statusId: {
            in: [
              // TP_STATUS_MAP.FIRST_CHOICE, 
              TP_STATUS_MAP.OPEN_CHAT
            ],
          },
        },
        _count: {
          statusId: true,
        },
        having: {
          statusId: {
            _count: {
              equals: 1,
              // equals: 2,
            },
          },
        },
      });

      const statusTalentIds = statusTalents
        .map((s) => s.talentPoolId)
        .filter((id): id is string => Boolean(id));

      const topTalents = await this.prisma.talentPool.findMany({
        where: {
          id: {
            in: statusTalentIds.length ? statusTalentIds : ["__none__"],
          },
        },
        take: topLimit,
        select: {
          id: true,
        },
      });

      const finalTalentIds = topTalents.map((t) => t.id);

      baseWhere.AND ||= [];
      baseWhere.AND.push({
        id: {
          in: finalTalentIds.length ? finalTalentIds : ["__none__"],
        },
      });
    }

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

    // const limit = recommendation ? 100 : topLimit !== null ? topLimit : Templimit > 0 ? Templimit : 100;
    let limit = 100; // default

    if (recommendation) {
      limit = 100;
    } else if (topLimit && topLimit > 0) {
      limit = topLimit;
    } else if (Templimit && Templimit > 0) {
      limit = Templimit;
    }
    console.log(limit, "final limit");

    const skip = (page - 1) * limit;

    // -------------------- total count --------------------
    const total = await this.prisma.talentPool.count({
      where: baseWhere,
    });

    // -------------------- fetch paginated data --------------------
    const data = await this.prisma.talentPool.findMany({
      where: baseWhere,
      // skip,
      // take: limit,
      // take: recommendation ? 100 : limit,
      include: {
        // blacklists: { where: { promoterId }, take: 1 },
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

    let sortedData: TalentPool[];
    const responseTimeMap = new Map<string, number>();
    const attendanceMap = new Map<string, number>();

    const attendedCountsRaw = await this.prisma.campaignInvitation.groupBy({
      by: ["talentId"],
      where: {
        status: InvitationStatus.ATTENDED,
      },
      _count: {
        id: true,
      },
    });

    for (const row of attendedCountsRaw) {
      attendanceMap.set(row.talentId, row._count.id);
    }

    const firstChoiceMap = new Map<string, boolean>();

    for (const talent of data) {
      const isFirstChoice = talent.userTpStatus?.some(
        (s) => s.statusId === TP_STATUS_MAP.FIRST_CHOICE,
      );
      firstChoiceMap.set(talent.id, Boolean(isFirstChoice));
    }

    if (topLimit && topLimit > 0) {
      //  TOP FLOW → group + trustScore + priority
      const allowedTypes = Object.keys(profilePriority);

      const filteredData = data.filter(
        (talent) =>
          talent.genre && allowedTypes.includes(talent.genre),
      );
      const grouped: Record<string, typeof filteredData> = {};

      for (const talent of filteredData) {
        const type = talent.genre!;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(talent);
      }
      // sort inside each group by trustScore DESC
      Object.values(grouped).forEach((group) => {
        group.sort((a, b) => {
          const trustA = a.promoterStates?.[0]?.trustScore ?? 0;
          const trustB = b.promoterStates?.[0]?.trustScore ?? 0;
          return trustB - trustA;
        });
      });
      // order groups by priority
      sortedData = allowedTypes.flatMap((type) => grouped[type] ?? []);
    } else {
      // NORMAL FLOW → global trustScore sort only
      sortedData = [...data].sort((a, b) => {
        const trustA = a.promoterStates?.[0]?.trustScore ?? 0;
        const trustB = b.promoterStates?.[0]?.trustScore ?? 0;
        // return trustB - trustA;
        if (trustA !== trustB) return trustB - trustA;

        if (recommendation) {
          const timeA = responseTimeMap.get(a.id);
          const timeB = responseTimeMap.get(b.id);

          if (timeA !== undefined || timeB !== undefined) {
            if (timeA === undefined) return 1;
            if (timeB === undefined) return -1;
            if (timeA !== timeB) return timeA - timeB;
          }

          const attendA = attendanceMap.get(a.id) ?? 0;
          const attendB = attendanceMap.get(b.id) ?? 0;
          if (attendA !== attendB) return attendB - attendA;

          const firstA = firstChoiceMap.get(a.id) ? 1 : 0;
          const firstB = firstChoiceMap.get(b.id) ? 1 : 0;
          if (firstA !== firstB) return firstB - firstA;
        }
        return 0;
      });
    }

    const start = (page - 1) * limit;
    const end = start + limit;

    const paginatedData = sortedData.slice(start, end);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
