import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";
import { Prisma } from "@prisma/client";
import {
  MessageDirection,
  InvitationStatus,
  CampaignMessage,
  Message,
  CampaignStatus,
  CampaignInvitation,
  AiPrompt,
} from "@prisma/client";
import {
  MESSAGE_INTERPRETATION_PROMPT,
  MESSAGE_INTERPRETATION_SYSTEM_PROMPT,
} from "./campaign-messages.config";
import { renderTemplate } from "utils/handlebar";
import { TalentBlacklistService } from "src/talend-blacklist/talent-blacklist.service";

interface MessageInterpretationResponse {
  status: InvitationStatus;
  score: number;
  score_reason: string;
  currentCity: string;
  futureCity: string,
  futureCityStartAt: string,
  futureCityEndAt: string,
  currentCityEndAt: string,
  cityHome: string,
  blacklist: string,
  reason: string
}

@Injectable()
export class CampaignMessagesAutomationService {
  private readonly logger = new Logger(CampaignMessagesAutomationService.name);
  private prompt: any;

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
    private readonly talentBlacklistService: TalentBlacklistService
  ) { }

  /**
   * Process messages that haven't been interpreted yet
   * Groups by campaignId and talentId, and interprets them
   * Runs every minute via cron
   */

  @Cron(CronExpression.EVERY_MINUTE)
  async processLastMinuteMessages(): Promise<void> {
    try {
      //here we will get the interpretation prompt and system prompt
      this.prompt = await this.prisma.aiPrompt.findFirst({
        where: {
          key: "INTERPRETATION",
        },
      });

      const messages = await this.prisma.message.findMany({
        where: {
          ai_processed: false,
          thread_id: { not: null },

          invitation: {
            is: {
              campaign: {
                status: {
                  not: CampaignStatus.completed,
                },
              },
            },
          },
        },

        include: {
          invitation: {
            include: {
              campaign: true,
            },
          },
        },

        orderBy: {
          created_at: "asc",
        },
      });

      const talentReplies = messages.filter((msg) => {
        if (!msg.invitation?.invitationAt || !msg.created_at) return false;

        return (
          msg.thread_id === msg.invitation.thread_id &&
          msg.sender_username === msg.invitation.talentId &&
          msg.created_at > msg.invitation.invitationAt
        );
      });

      if (talentReplies.length === 0) {
        this.logger.log("No new messages to process");
        return;
      }

      this.logger.log(`Found ${talentReplies.length} messages to process`);

      for (const message of talentReplies) {
        const invitationAt = message.invitation?.invitationAt;
        const threads = await this.prisma.message.findMany({
          select: {
            message: true,
            created_at: true,
            sender_username: true,

          },
          where: {
            thread_id: (message as any).thread_id,
            ai_processed: false,
            sender_username: (message as any).sender_username,
            ...(invitationAt && {
              created_at: {
                gt: invitationAt,
              },
            }),
          } as any,
          orderBy: {
            created_at: "asc",
          },
        });

        const talent = await this.prisma.talentPool.findUnique({
          where: {
            id: message.invitation?.talentId
          }
        })

        const fullMessage =
          `Current City: ${talent?.currentCity || "Unknown"}\n\n` +
          `Talent Name : ${talent?.id || "Unknown"}\n\n` +
          threads
            .map(
              (msg) => `${msg.sender_username} : ${msg.created_at} ${msg.message}`
            )
            .join("\n\n");


        // const fullMessage = threads
        //   .map(
        //     (msg) => msg.sender_username + " : " + msg.created_at + msg.message + talent?.currentCity,
        //   )
        //   .join("\n\n");
        // add here also talent current city

        const invitation = await this.prisma.campaignInvitation.findFirst({
          where: {
            id: message.invitation?.id,
          },
          select: {
            id: true,
            promoterId: true,
            eventId: true,
            campaignId: true,
            talentId: true,
          },
        });

        if (!invitation) {
          continue;
        }

        await this.processTalentMessages(
          message as unknown as Message,
          invitation as unknown as CampaignInvitation & {
            invitation: {
              id: number;
              promoterId: bigint;
              eventId: number;
              campaignId: number;
              talentId: string;
            } | null;
          },
          fullMessage,
        );
      }
    } catch (error) {
      this.logger.error("Error processing last minute messages:", error);
      throw error;
    }
  }
  /**
   * Process messages for a specific talent in a campaign
   */

  private async processTalentMessages(
    message: Message,
    invitation: CampaignInvitation & {
      invitation: {
        id: number;
        promoterId: bigint;
        eventId: number;
        campaignId: number;
        talentId: string;
      } | null;
    },
    fullMessage: string,
  ): Promise<void> {
    try {
      const invitationData = invitation;
      if (!invitation) {
        this.logger.warn(`No invitation found for message ${message.id}`);
        return;
      }

      const { promoterId, eventId, campaignId, talentId } = invitationData;
      const invitationId = invitation.id;

      // Prepare the prompt
      const prompt = renderTemplate(this.prompt.defs, {
        messages: fullMessage,
      });
      const sysPrompt = this.prompt.role;

      // Call OpenAI to interpret
      let interpretation: MessageInterpretationResponse;
      try {
        const response = await this.openAIService.query(prompt, sysPrompt);
        console.log(response, "incoming response from ai")
        interpretation = {
          status: this.mapStatusToEnum(response.status),
          score: response.score || 0,
          score_reason: response.score_reason || "neutral_reply",
          currentCity: response.currentCity || "default",
          futureCity: response.futureCity,
          futureCityStartAt: response.futureCityStartAt,
          futureCityEndAt: response.futureCityEndAt,
          currentCityEndAt: response.currentCityEndAt,
          cityHome: response.cityHome,
          blacklist: response.blacklist,
          reason: response.reason

        };
      } catch (error) {
        this.logger.error(
          `Error calling OpenAI for campaign ${invitation.campaignId}, talent ${invitation.talentId}:`,
          error,
        );
        // Use default values if OpenAI fails
        return;
      }
      // Update CampaignInvitation status, mark as replied and mark as seen using invitationId
      const update = await this.prisma.campaignInvitation.update({
        where: {
          id: invitationId,
        },
        data: {
          status: interpretation.status,
          hasReplied: true,
          isSeen: true,
        },
      });

      // Get or create TalentPromoterState
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
            lastReply: new Date(),
          },
        });
      }

      function toUTC(date?: string | Date | null, isEnd = false): Date | null {
        if (!date) return null;

        const d = new Date(date);
        if (isEnd) {
          d.setUTCHours(23, 59, 59, 0);
        } else {
          d.setUTCHours(0, 0, 0, 0);
        }

        return d;
      }

      if (interpretation.futureCity && interpretation.futureCity !== "default") {
        const startUTC = toUTC(interpretation.futureCityStartAt, false);
        const endUTC = toUTC(interpretation.futureCityEndAt, true);

        await this.prisma.talentPool.update({
          where: { id: talentId },
          data: {
            futureCity: interpretation.futureCity,
            futureCityStartAt: startUTC,
            futureCityEndAt: endUTC,
          },
        });
      }




      // Update trust score
      const newTrustScore =
        talentPromoterState.trustScore + interpretation.score;
      const lastReceivedAt = message.created_at || new Date();

      await this.prisma.talentPromoterState.update({
        where: {
          talentId_promoterId: {
            talentId,
            promoterId: BigInt(promoterId),
          },
        },
        data: {
          trustScore: newTrustScore,
          lastReply: lastReceivedAt,
        },
      });

      // Create TrustScoreLog entry
      await this.prisma.trustScoreLog.create({
        data: {
          talentId,
          promoterId: BigInt(promoterId),
          eventId: Number(eventId),
          change: interpretation.score,
          reason: interpretation.score_reason,
        },
      });

      // Update talent's current location if provided and different from default
      if (
        interpretation.currentCity &&
        interpretation.currentCity !== "default"
      ) {

        await this.prisma.talentPool.update({
          where: { id: talentId },
          data: {
            currentCity: interpretation.currentCity,
            currentCityEndAt:
              interpretation.currentCityEndAt &&
                interpretation.currentCityEndAt.trim() !== ""
                ? new Date(interpretation.currentCityEndAt)
                : null,

          },
        });
      }

      if (
        interpretation.cityHome &&
        interpretation.cityHome !== "default"
      ) {
        await this.prisma.talentPool.update({
          where: { id: talentId },
          data: {
            cityHome: interpretation.cityHome,
            cityHomeUpdated: new Date()
          },
        });
      }
      if (interpretation.blacklist) {
        let createTalentBlacklistDto = { talentId: talentId, reason: interpretation.reason }
        await this.talentBlacklistService.create(createTalentBlacklistDto, Number(promoterId))
      }

      await this.prisma.message.updateMany({
        where: {
          ai_processed: false,
          id: {
            in: [message.id],
          },
        },
        data: {
          ai_processed: true,
          ai_processed_at: new Date(),
        },
      });

      this.logger.log(
        `Processed messages for campaign ${campaignId}, talent ${talentId}. Status: ${interpretation.status}, Score: ${interpretation.score}`,
      );
    } catch (error) {
      this.logger.error(`Error processing message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Map string status to InvitationStatus enum
   */
  private mapStatusToEnum(status: string): InvitationStatus {
    const statusMap: Record<string, InvitationStatus> = {
      pending: InvitationStatus.pending,
      sent: InvitationStatus.sent,
      confirmed: InvitationStatus.confirmed,
      declined: InvitationStatus.declined,
      maybe: InvitationStatus.maybe,
      ignored: InvitationStatus.ignored,
      attended: InvitationStatus.attended,
      interested: InvitationStatus.interested,
      optout: InvitationStatus.optout,
      moved: InvitationStatus.moved,
    };

    return statusMap[status.toLowerCase()] || InvitationStatus.pending;
  }
}
