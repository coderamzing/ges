import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TalentPool } from "@prisma/client";
import { TalentRecommendationFiltersDto } from "./talent.dto";
// import { InvitationStatus } from "@prisma/client";
import {
  InvitationStatus,
  type InvitationStatusType,
} from "src/campaign-invitation/campaign-invitation.config";
import { TP_STATUS_MAP } from "./talent.config";
import { Prisma } from "@prisma/client";

type TalentWithRelations = Prisma.TalentPoolGetPayload<{
  include: {
    promoterStates: {
      select: { trustScore: true };
    };
    userTpStatus: {
      select: {
        id: true;
        statusId: true;
        statusName: true;
        createdAt: true;
      };
    };
  };
}>;
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
    promoterId: number,
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

    // const promoterId = event.userId ? BigInt(event.userId) : null;
    // if (!promoterId) throw new NotFoundException(`Event has no promoter`);

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
      baseWhere.AND.push(
        ...normalStatusIds.map((statusId) => ({
          userTpStatus: {
            some: {
              userId: promoterId,
              statusId,
            },
          },
        })),
      );
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
      Supermodels: 1,
      Models: 2,
      Hybrids: 3,
      Civilians: 4,
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
    console.log(profilePriority, "profile prioeot");
    // handle top N logic here
    const topLimit = filters.top ?? null;
    console.log(topLimit, "topLimit");
    console.log(promoterId, "incoming promoter id ");

    // exclude talent who already send invitation in same campaign
    let excludedTalentIds: string[] = [];
    const invited = await this.prisma.campaignInvitation.findMany({
      where: { campaignId },
      select: { talentId: true },
    });
    console.log("already invited in same campaign-----", invited.length)
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

    // const skip = (page - 1) * limit;

    console.log("baseWhere--->", baseWhere);

    // -------------------- total count --------------------
    const total = await this.prisma.talentPool.count({
      where: baseWhere,
    });

    // -------------------- fetch paginated data --------------------
    const data: TalentWithRelations[] = await this.prisma.talentPool.findMany({
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
    console.log("final data length---->", data.length);

    // console.log("final data", data);
    const totalPages = Math.ceil(total / limit);

    let sortedData: TalentPool[];
    const responseTimeMap = new Map<string, number>();
    const attendanceMap = new Map<string, number>();

    const attendedCountsRaw = await this.prisma.campaignInvitation.groupBy({
      by: ["talentId"],
      where: {
        // status: InvitationStatus.ATTENDED,
        thankYouSent:true,
        thankYou:true
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
    console.log("firstChoiceMap-------", firstChoiceMap);

    enum ChoiceType {
      FIRST = 1,
      BACKUP = 2,
      NONE = 3,
    }

    function getChoiceType(talent: TalentWithRelations): ChoiceType {
      if (
        talent.userTpStatus?.some(
          (s) => s.statusId === TP_STATUS_MAP.FIRST_CHOICE,
        )
      ) {
        return ChoiceType.FIRST;
      }

      if (
        talent.userTpStatus?.some(
          (s) => s.statusId === TP_STATUS_MAP.BACKUP_GUEST,
        )
      ) {
        return ChoiceType.BACKUP;
      }

      return ChoiceType.NONE;
    }

    const GENRE_ORDER: Record<string, number> = {
      Supermodels: 1,
      Models: 2,
      Hybrids: 3,
      Civilians: 4,
    };


    if (topLimit && topLimit > 0) {

      const talentIds = data.map(t => t.id);

      const recentMessages = await this.prisma.message.findMany({
        where: {
          user_id: promoterId,
          receiver_username: { in: talentIds },
          created_at: {
            gte: cutoffDate,
          },
        },
        select: {
          receiver_username: true,
        },
      });

      // Create set of excluded talents
      const excludedTalentIds = new Set(recentMessages.map(m => m.receiver_username));

      // FILTER talents (exclude those contacted in last 48 hours)
      const filteredData = data.filter(talent => !excludedTalentIds.has(talent.id));

      // GROUP BY GENRE
      const groupedByGenre: Record<string, TalentWithRelations[]> = {};

      for (const talent of filteredData) {
        if (!talent.genre) continue;
        if (GENRE_ORDER[talent.genre] === undefined) continue;

        if (!groupedByGenre[talent.genre]) {
          groupedByGenre[talent.genre] = [];
        }
        groupedByGenre[talent.genre].push(talent);
      }
      console.log("groupedByGenre------>", groupedByGenre)

      // SORT INSIDE EACH GENRE
      for (const genre of Object.keys(groupedByGenre)) {
        groupedByGenre[genre].sort((a, b) => {
          const choiceDiff = getChoiceType(a) - getChoiceType(b);
          if (choiceDiff !== 0) return choiceDiff;

          // TrustScore DESC inside same choice bucket
          const trustA = a.promoterStates?.[0]?.trustScore ?? 0;
          const trustB = b.promoterStates?.[0]?.trustScore ?? 0;
          if (trustA !== trustB) return trustB - trustA;

          return 0;
        });
      }

      // FLATTEN BY GENRE ORDER
      sortedData = Object.entries(GENRE_ORDER)
        .sort(([, a], [, b]) => a - b)
        .flatMap(([genre]) => groupedByGenre[genre] ?? []);
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
    console.log("sorted data length------->", sortedData.length);

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


