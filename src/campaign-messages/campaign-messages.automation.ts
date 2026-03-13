import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";
import { Campaign, Events, Prisma } from "@prisma/client";
import {
  // InvitationStatus,
  Message,
  CampaignStatus,
  CampaignInvitation,
} from "@prisma/client";
import { renderTemplate } from "utils/handlebar";
import { TalentBlacklistService } from "src/talend-blacklist/talent-blacklist.service";
import { TP_STATUS_MAP } from "src/talent/talent.config";
import { updateUserTpStatus } from "src/talent/talent.utils";
import {
  InvitationStatus,
  type InvitationStatusType,
} from "src/campaign-invitation/campaign-invitation.config";

interface MessageInterpretationResponse {
  status: InvitationStatusType | null | 'null';
  score: number;
  score_reason: string;
  blacklist: string | null;
  reason: string;
  messageLanguage: string;
  mentioned_other_date: string | null;
}

type CampaignInvitationHydrated = CampaignInvitation & {
  campaign: Campaign;
  event: Events;
};

type MessageWithInvitationAndEvent = Message & {
  invitation: CampaignInvitationHydrated;
};

@Injectable()
export class CampaignMessagesAutomationService {
  private readonly logger = new Logger(CampaignMessagesAutomationService.name);
  private prompt: any;

  private async campaignTargetReached(campaignId: number, eventId: number) {
    const currentBatchCount = await this.prisma.campaignInvitation.count({
      where: {
        campaignId,
        status: {
          in: [InvitationStatus.CONFIRMED],
        },
      },
    });
    const event = await this.prisma.events.findFirst({
      where: {
        id: eventId,
      },
    });

    const target = (() => {
      switch (event?.mainEventType) {
        case "Club Only":
          return event.clubGuests ?? 0;

        case "Dinner Only":
          return event.dinnerGuests ?? 0;

        case "Pre-Drink+Club":
          return (event.preDrinkGuests ?? 0) + (event.clubGuests ?? 0);

        case "Dinner+Club":
          return (event.dinnerGuests ?? 0) + (event.clubGuests ?? 0);

        default:
          return 0;
      }
    })();

    // const guests = event?.guests ?? 10;
    const guests = target;

    if (currentBatchCount >= guests) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { end_at: new Date(), status: CampaignStatus.completed },
      });
      this.logger.log(`Campaign ${campaignId} end_at updated at ${new Date()}`);
    } else {
      this.logger.log(
        `Campaign ${campaignId}  has ${currentBatchCount} invitations.`,
      );
    }
  }

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
    private readonly talentBlacklistService: TalentBlacklistService,
  ) {}

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

      if (!this.prompt) {
        this.logger.warn("EVENT_INTERPRETATION prompt not found");
        return;
      }

      // const messages = await this.prisma.message.findMany({
      //   where: {
      //     thread_id: { not: null },
      //   },
      //   orderBy: {
      //     created_at: "asc",
      //   },
      // });

      // if (!messages.length) {
      //   return;
      // }

      // const threadIds = messages
      //   .map((m) => m.thread_id)
      //   .filter((id): id is string => !!id);

      const invitations = await this.prisma.campaignInvitation.findMany({
        where: {
          status: {
            notIn: [InvitationStatus.DECLINED, InvitationStatus.INIT],
          },
        },
        include: {
          campaign: true,
        },
      });

      const now = new Date();

      for (const invitation of invitations) {
        if (!invitation.invitationAt) continue;

        const diffMs = now.getTime() - invitation.invitationAt.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (
          !invitation.hasReplied &&
          invitation.status == InvitationStatus.SENT &&
          diffHours > 2
        ) {

          this.logger.log(`Processing Marking NO_REPLY for invitation ${invitation.id}`);

          await this.prisma.campaignInvitation.update({
            where: { id: invitation.id },
            data: {
              status: InvitationStatus.NOREPLY,
            },
          });
          this.logger.log(`Marked NO_REPLY for invitation ${invitation.id}`);
        }
      }

      const invitationMap = new Map(
        invitations.map((inv) => [inv.thread_id, inv]),
      );

      const threadIds = invitations
        .map((inv) => inv.thread_id)
        .filter((id): id is string => Boolean(id));

      const talentIds = invitations
        .map((inv) => inv.talentId)
        .filter((id): id is string => Boolean(id));

      const lastMessages = await this.prisma.message.findMany({
        where: {
          thread_id: {
            in: threadIds,
          },
          sender_username: {
            in: talentIds,
          },
        },
        orderBy: {
          tm: "desc",
        },
        take:5
      });


      const reversedMessage = lastMessages.reverse();

      const filteredMessages = reversedMessage.filter((msg) => {
        const invitation = invitationMap.get(msg.thread_id);
        if (!invitation || !invitation.invitationAt || !msg?.created_at)
          return false;

        return msg?.created_at > invitation.invitationAt;
      });

      const messages = filteredMessages;

      const result: MessageWithInvitationAndEvent[] = [];

      for (const msg of messages) {
        const invitation = invitationMap.get(msg.thread_id!);
        if (!invitation) continue;

        if (!invitation.eventId) continue;

        const event = await this.prisma.events.findUnique({
          where: { id: invitation.eventId },
        });

        if (!event || !event.dt) continue;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const eventDate = new Date(event.dt);
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        this.logger.debug(`today Date: ${today}`)
        this.logger.debug(`event Date: ${eventDay}`)

        if (eventDay < today) {
          continue;
        }

        if (
          !invitation.campaign ||
          invitation.campaign.status === CampaignStatus.completed
        ) {
          continue;
        }

        result.push({
          ...msg,
          invitation: {
            ...invitation,
            event,
          },
        });
      }

      const talentReplies = result.filter((msg) => {
        if (!msg.invitation?.invitationAt || !msg.created_at) return false;
        const invitation = msg.invitation as any;

        return (
          msg.thread_id === invitation.thread_id &&
          msg.sender_username === invitation.talentId &&
          msg.created_at > invitation.invitationAt
        );
      });

      if (talentReplies.length === 0) {
        this.logger.log("No new messages to process");
        return;
      }

      this.logger.log(`Found ${talentReplies.length} messages to process`);

      for (const message of talentReplies) {
        const event = message.invitation?.event;
        const campaign = message.invitation?.campaign;
        
        let threadData:any;
        if(message.thread_id){
          threadData = await this.prisma.thread.findUnique({
            where: {
              id: message.thread_id,
            },
          });
        }
        if (!threadData || !threadData.username2) continue;

        const talentUsername = threadData.username2;
        const promoterUsername = threadData.username1;

        const DAYS = 2;
        const daysAgo = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
        console.log("daysAgo",daysAgo)
        const invitationAt = (message.invitation as any)?.invitationAt;
        const startDate = invitationAt ? new Date(Math.max(new Date(invitationAt).getTime(), daysAgo.getTime())) : daysAgo;

        console.log("startDate",startDate)
        const threads = await this.prisma.message.findMany({
          select: {
            message: true,
            created_at: true,
            sender_username: true,
            tm:true,
          },
          where: {
            thread_id: (message as any).thread_id,
            // sender_username: (message as any).sender_username,
            ...(invitationAt && {
              created_at: {
                gt: startDate,
              },
            }),
          } as any,
          orderBy: {
            tm: "asc",
          },
        });

        const talent = await this.prisma.talentPool.findUnique({
          where: {
            id: message.invitation?.talentId,
          },
        });

        const fullMessage =
          `Time Now: ${new Date().toISOString()}\n\n` +
          (event?.city ? `Event City: ${event?.city}\n\n` : "") +
          (event?.name ? `Event Name: ${event?.name}\n\n` : "") +
          (event?.dt ? `Event Date: ${new Date(event?.dt).toISOString()}\n\n` : "") +
          (talent?.cityHome ? `Talent In City: ${talent?.cityHome}\n\n` : "") +
          (invitationAt ? `InvitationSentAt: ${new Date(invitationAt).toISOString()}\n\n` : "") +
          // threads
          //   .map((msg) => `${msg.created_at}: ${msg.message}`)
          //   .join("\n\n");
           `Conversation:\n\n` +
          threads
            .map((msg) => {
              const label =
                talentUsername && msg.sender_username === talentUsername
                  ? "Talent"
                  : "Promoter";
              return `[${msg.tm?.toISOString() || msg.created_at?.toISOString()}] [${label}]: ${msg.message}`;
            })
            .join("\n\n");
            console.log("full message",fullMessage)

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
        throw new Error(`No invitation found for message ${message.id}`);
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
        console.log("Incominf response from ai ", response);
        interpretation = {
          status: response.status ? this.mapStatusToEnum(response.status) : null,
          score: response.score || 0,
          score_reason: response.score_reason || "neutral_reply",
          blacklist: null,
          reason: response.reason,
          messageLanguage: response.language,
          mentioned_other_date: response.mentioned_other_date,
        };
      } catch (error) {
        throw new Error(
          `Error calling OpenAI for campaign ${invitation.campaignId}, talent ${invitation.talentId}:`,
          error,
        );
      }

      // Update CampaignInvitation status, mark as replied and mark as seen using invitationId
      if(interpretation.status && interpretation.status !== 'null'){
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
        this.logger.log(`status updated: ${interpretation.status}`)
        await this.campaignTargetReached(
          update.campaignId,
          Number(update.eventId),
        );
      }


      if (interpretation.status == InvitationStatus.BLACKLIST) {
        await updateUserTpStatus({
          userId: BigInt(promoterId),
          talentPoolId: talentId,
          statusId: TP_STATUS_MAP.BLACKLIST,
        });
      }

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

      const lastReceivedAt = message.created_at || new Date();
      if (interpretation.score !== 0) {
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
            change: interpretation.score,
            reason: interpretation.score_reason,
          },
        });
      } else {
        const trustScore = await this.prisma.trustScoreLog.create({
          data: {
            talentId,
            promoterId: BigInt(promoterId),
            eventId: Number(eventId),
            change: interpretation.score,
            reason: interpretation.score_reason,
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
          // lastReply: lastReceivedAt,
        },
      });
       this.logger.log(
        `Score updated for talent ${talentId}, Score: ${interpretation.score} in the campaign ${campaignId}`,
      );
    }

     await this.prisma.talentPromoterState.update({
        where: {
          talentId_promoterId: {
            talentId,
            promoterId: BigInt(promoterId),
          },
        },
        data: {
          // trustScore: newTrustScore,
          lastReply: lastReceivedAt,
        },
      });

      // if (interpretation.blacklist) {
      //   let createTalentBlacklistDto = {
      //     talentId: talentId,
      //     reason: interpretation.reason,
      //   };
      //   const existingBlacklist = await this.prisma.talentBlacklist.findUnique({
      //     where: {
      //       talentId_promoterId: {
      //         talentId: talentId,
      //         promoterId: BigInt(promoterId),
      //       },
      //     },
      //   });
      //   if (!existingBlacklist) {
      //     await this.talentBlacklistService.create(
      //       createTalentBlacklistDto,
      //       Number(promoterId),
      //     );
      //   }
      // }

      await updateUserTpStatus({
        userId: BigInt(promoterId),
        talentPoolId: talentId,
        statusId: TP_STATUS_MAP.OPEN_CHAT,
      });

      this.logger.log(
        `Processed messages for campaign ${campaignId}, talent ${talentId}. Status: ${interpretation.status}`,
      );

      if (interpretation.messageLanguage) {
        await this.prisma.talentPool.update({
          where: {
            id: talentId,
          },
          data: {
            language: interpretation.messageLanguage,
          },
        });
      }

      if (interpretation.mentioned_other_date) {
        const event = await this.prisma.events.findFirst({
          where: {
            userId: BigInt(promoterId),
            dt: new Date(interpretation.mentioned_other_date),
          },
        });

        if (!event) {
          this.logger.log(
            `No event found for this promotor: ${promoterId}, by mentioned_other_date :${interpretation.mentioned_other_date}.`,
          );
          return;
        }

        const campaign = await this.prisma.campaign.findFirst({
          where: {
            eventId: event.id,
          },
        });

        if (!campaign) return;

        const existingInvitation =
          await this.prisma.campaignInvitation.findUnique({
            where: {
              campaignId_talentId: {
                campaignId: campaign.id,
                talentId: talentId,
              },
            },
          });

        if (!existingInvitation) {
          const createInvitation = await this.prisma.campaignInvitation.create({
            data: {
              campaignId: campaign.id,
              eventId: event.id,
              promoterId: BigInt(promoterId),
              talentId,
              batch: 1,
              status: InvitationStatus.INIT,
            },
          });
          this.logger.log(
            `Create invitation for this campaign: ${campaignId}, talent: ${talentId}, Event: ${event.id} by future date available:${interpretation.mentioned_other_date}.`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error processing message ${message.id}:`, error);
      throw error;
    } finally {
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
        `Processed message interpretation for this talent: ${invitation.talentId}`,
      );
    }
  }

  /**
   * Map string status to InvitationStatus enum
   */
  private mapStatusToEnum(status: string): InvitationStatusType {
    const statusMap: Record<string, InvitationStatusType> = {
      pending: InvitationStatus.PENDING,
      sent: InvitationStatus.SENT,
      confirmed: InvitationStatus.CONFIRMED,
      declined: InvitationStatus.DECLINED,
      maybe: InvitationStatus.MAYBE,
      ignored: InvitationStatus.IGNORED,
      attended: InvitationStatus.ATTENDED,
      interested: InvitationStatus.INTERESTED,
      optout: InvitationStatus.OPTOUT,
      moved: InvitationStatus.MOVED,
      blacklist: InvitationStatus.BLACKLIST,
      init:InvitationStatus.INIT,
      "soft-decline": InvitationStatus.SOFT_DECLINE,
      "no-reply": InvitationStatus.NOREPLY,
    };

    return statusMap[status.toLowerCase()] || InvitationStatus.INIT;
  }
}
