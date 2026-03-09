import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { InvitationStatus } from "src/campaign-invitation/campaign-invitation.config";

@Injectable()
export class TalentAutomationService {
  private readonly logger = new Logger(TalentAutomationService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async updateFutureCities(): Promise<void> {
    const now = new Date(new Date().toISOString());
    this.logger.log(`process update future location of talent`);
    try {
      const talents = await this.prisma.talentPool.findMany({
        where: {
          OR: [
            {
              futureCity: { not: null },
              futureCityStartAt: { lte: now },
            },
            {
              currentCity: { not: null },
              currentCityEndAt: { lt: now },
            },
          ],
        },
      });
      if (talents.length === 0) {
        this.logger.log(`No future cities to update at this time.`);
        return;
      }

      for (const talent of talents) {
        let currentCityEndAt = talent.currentCityEndAt;
        let futureCityStartAt = talent.futureCityStartAt;

        if (talent.currentCity && currentCityEndAt) {
          if (
            currentCityEndAt < now &&
            talent.futureCity === null &&
            talent.futureCityStartAt === null
          ) {
            await this.prisma.talentPool.update({
              where: { id: talent.id },
              data: {
                lastCity: talent.currentCity,
                lastCityUpdateDate: new Date(),
                currentCity: talent.cityHome?.trim() || talent.city,
                city: talent.cityHome?.trim() || talent.city,
                currentCityEndAt: null,
                storyDateTime: new Date(),
                locationUpdatedAt: new Date(),
                foundCityMethod: "MSG",
                storyPicture: null,
                location: null,
              },
            });
            this.logger.log(
              `Updated talent ${talent.id}: current_city set to ${talent.cityHome?.trim() || talent.city}`,
            );
          }
        }
        if (talent.futureCity && futureCityStartAt) {
          if (futureCityStartAt < now) {
            await this.prisma.talentPool.update({
              where: { id: talent.id },
              data: {
                lastCity: talent.currentCity,
                lastCityUpdateDate: new Date(),
                currentCity: talent.futureCity,
                city: talent.futureCity,
                country: talent.futureCountry,
                continent: talent.futureContinent,
                currentCityEndAt: talent.futureCityEndAt,
                storyDateTime: new Date(),
                futureCity: null,
                futureCityStartAt: null,
                futureCityEndAt: null,
                futureCountry: null,
                futureContinent: null,
                locationUpdatedAt: new Date(),
                foundCityMethod: "MSG",
                storyPicture: null,
                location: null,
              },
            });
            this.logger.log(
              `Updated talent ${talent.id}: current_city set to ${talent.futureCity}`,
            );
          }
        }
      }
    } catch (err) {
      console.error("Error updating future cities:", err);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateScoreWithNoReply(): Promise<void> {
    try {
      const now = new Date();

      console.log("now", now);

      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      console.log("todayStart", todayStart);

      const yesterdayStart = new Date(todayStart);
      console.log("yesterdayStart", yesterdayStart);
      yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
      console.log("yesterdayStart1", yesterdayStart);

      const invitations = await this.prisma.campaignInvitation.findMany({
        where: {
          status: {
            in: [InvitationStatus.SENT, InvitationStatus.NOREPLY],
          },
          event: {
            dt: {
              gte: yesterdayStart,
              lt: todayStart,
            },
          },
        },
      });

      this.logger.log(`Total invitations found: ${invitations.length}`);

      if (!invitations.length) {
        return;
      }
      for (const invitation of invitations) {
        const talentId = invitation.talentId;
        const promoterId = invitation.promoterId;
        const eventId = invitation.eventId;
        this.logger.log(
          `Processing invitation → Talent: ${talentId}, Promoter: ${promoterId}, Event: ${eventId}`,
        );
        let talentPromoterState =
          await this.prisma.talentPromoterState.findUnique({
            where: {
              talentId_promoterId: {
                talentId,
                promoterId: BigInt(promoterId),
              },
            },
          });

        if (!talentPromoterState) {
          talentPromoterState = await this.prisma.talentPromoterState.create({
            data: {
              talentId,
              promoterId: BigInt(promoterId),
              trustScore: 0,
            },
          });
        }

        const existing = await this.prisma.trustScoreLog.findFirst({
          where: {
            talentId,
            promoterId: BigInt(promoterId),
            eventId: Number(eventId),
          },
        });

        if (existing) {
          await this.prisma.trustScoreLog.update({
            where: { id: existing.id },
            data: {
              change: -5,
              reason: "no reply",
            },
          });
        } else {
          const trustScore = await this.prisma.trustScoreLog.create({
            data: {
              talentId,
              promoterId: BigInt(promoterId),
              eventId: Number(eventId),
              change: -5,
              reason: "no reply",
            },
          });
        }

        const trustScoreAgg = await this.prisma.trustScoreLog.aggregate({
          where: {
            talentId,
            promoterId: BigInt(promoterId),
          },
          _sum: {
            change: true,
          },
        });

        const newTrustScore = trustScoreAgg._sum?.change ?? 0;

        await this.prisma.talentPromoterState.update({
          where: {
            talentId_promoterId: {
              talentId,
              promoterId: BigInt(promoterId),
            },
          },
          data: {
            trustScore: newTrustScore,
          },
        });

        this.logger.log(
          `Updated total trust score: ${newTrustScore} for Talent: ${talentId}`,
        );
      }
    } catch (err) {
      console.error("Error updating future cities:", err);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncInvitationThreads() {
    try {
      const invitations = await this.prisma.campaignInvitation.findMany({
        where: {
          thread_id: null,
        },
        select: {
          id: true,
          talentId: true,
          promoterId: true,
        },
        take: 500,
      });

      for (const invitation of invitations) {
        const thread = await this.prisma.thread.findFirst({
          where: {
            username2: invitation.talentId,
            user_id: invitation.promoterId,
          },
          select: {
            id: true,
          },
        });
        
        if (thread) {
          await this.prisma.campaignInvitation.update({
            where: {
              id: invitation.id,
            },
            data: {
              thread_id: thread.id,
            },
          });
        this.logger.log(`Invitation updated with threadId for talent: ${invitation.talentId}, invitationId: ${invitation.id}, promoterId: ${invitation.promoterId}.`);
        }
      }

      this.logger.log(
        `Thread sync completed. Checked ${invitations.length} invitations.`,
      );
    } catch (error) {
      console.error("Error syncing invitation threads:", error);
    }
  }
}
