import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignMessagesService } from "../campaign-messages/campaign-messages.service";
import { CampaignInvitationService } from "./campaign-invitation.service";
import { updateUserTpStatus } from "src/talent/talent.utils";
import {
  InvitationStatus,
  TemplateType,
  Prisma,
  CampaignStatus,
} from "@prisma/client";
import { renderTemplate } from "utils/handlebar";
import { SendMessageResponse } from "./campaign-invitation.types";
import { TP_STATUS_MAP } from "../talent/talent.config";

@Injectable()
export class CampaignInvitationAutomationService {
  private readonly logger = new Logger(
    CampaignInvitationAutomationService.name,
  );

  /**
   * Check if enough time has passed since last sent message for a promoter
   * Returns true if we should send, false if we should wait
   */
  private async shouldSendMessage(
    promoterId: bigint,
    delayMinutes?: number[],
  ): Promise<boolean> {
    // Get the last sent message for this promoter
    const lastMessage = await this.prisma.message.findFirst({
      where: {
        sender: promoterId,
        invite: true,
        ai_processed: true,
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        created_at: true,
      },
    });

    if (!lastMessage || !lastMessage.created_at) {
      return true; // No previous message, can send
    }

    const now = Date.now();
    const lastSent = lastMessage.created_at.getTime();
    let minutes: number;

    if (delayMinutes && delayMinutes.length === 2) {
      // Use provided range
      const min = Math.min(delayMinutes[0], delayMinutes[1]);
      const max = Math.max(delayMinutes[0], delayMinutes[1]);

      minutes = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      // Default random 1–3 minutes
      minutes = Math.floor(Math.random() * 3) + 1;
    }

    this.logger.log(`Random Delay time add`);

    const requiredGapMs = minutes * 60 * 1000;

    return now - lastSent >= requiredGapMs;
  }

  private async updateTalentPromoterState(params: {
    talentId: string;
    promoterId: bigint;
    lastContacted?: Date | null;
    trustScoreIncrement?: number;
    eventId?: number;
    scoreReason?: string;
  }) {
    const {
      talentId,
      promoterId,
      lastContacted,
      trustScoreIncrement = 0,
      eventId,
      scoreReason,
    } = params;

    const safeLastContacted = lastContacted ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const state = await tx.talentPromoterState.upsert({
        where: {
          talentId_promoterId: {
            talentId,
            promoterId,
          },
        },
        create: {
          talentId,
          promoterId,
          trustScore: trustScoreIncrement,
          lastContacted: safeLastContacted,
        },
        update: {
          lastContacted: safeLastContacted,
          ...(trustScoreIncrement > 0 && {
            trustScore: {
              increment: trustScoreIncrement,
            },
          }),
        },
      });

      // Create trust score log ONLY if score increment exists
      if (trustScoreIncrement > 0) {
        await tx.trustScoreLog.create({
          data: {
            talentId,
            promoterId,
            eventId: eventId ?? null,
            change: trustScoreIncrement,
            reason: scoreReason ?? "SYSTEM_UPDATE",
          },
        });
      }

      return state;
    });
  }

  private async getFinalTemplateContent(params: {
    campaignId: number;
    templateType: TemplateType;
    talentLang: string;
  }): Promise<string | null> {
    const { campaignId, templateType, talentLang } = params;

    let campaignTemplate = await this.prisma.campaignTemplate.findFirst({
      where: {
        campaignId,
        type: templateType,
        lang: talentLang,
        isActive: true,
      },
    });

    if (!campaignTemplate) {
      campaignTemplate = await this.prisma.campaignTemplate.findFirst({
        where: {
          campaignId,
          type: templateType,
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    if (!campaignTemplate) {
      this.logger.warn(
        `No active campaign template found for campaign ${campaignId}, type ${templateType}`,
      );
      return null;
    }

    if (!campaignTemplate.spintaxEnabled) {
      this.logger.log(
        `Spintax disabled, using base template ${campaignTemplate.id}`,
      );
      return campaignTemplate.content;
    }

    const spintaxTemplates = await this.prisma.campaignSpintaxTemplate.findMany(
      {
        where: {
          campaignId: campaignId,
          type: templateType,
          lang: { in: ["en", talentLang] },
        },
      },
    );

    let preferred = spintaxTemplates.filter((t) => t.lang === talentLang);

    if (!preferred.length) {
      preferred = spintaxTemplates.filter((t) => t.lang === "en");
    }

    if (!preferred.length) {
      this.logger.warn(
        `Spintax enabled but no spintax templates found for campaign ${campaignId}, type ${templateType}`,
      );
      return null;
    }

    const randomSpintax =
      preferred[Math.floor(Math.random() * preferred.length)];

    this.logger.log(
      `Using spintax template ${randomSpintax.id} for campaign ${campaignId}`,
    );

    return randomSpintax.content;
  }

  private async sendMessageCommon(params: {
    receiverId: string;
    promoterId: bigint;
    message: string;
    invitationId: number;
  }): Promise<SendMessageResponse | undefined> {
    const { receiverId, promoterId, message, invitationId } = params;
    const token = process.env.TEMP_TOKEN || null;
    const senderId = Number(promoterId);

    try {
      const response = await this.campaignInvitationService.sendMessage(
        token,
        receiverId,
        message,
        senderId,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to send message for invitation ${invitationId}:`,
        error,
      );

      throw new Error(
        `Automation stopped: Failed to send message - ${error?.message || error
        }`,
      );
    }
  }

  private async checkAndUpdateCampaignEnd(campaignId: number, batchId: number) {
    // Count current batch invitations
    const currentBatchCount = await this.prisma.campaignInvitation.count({
      where: {
        campaignId,
        batch: batchId,
        status: {
          not: "pending",
        },
      },
    });

    // If batch 2 reaches 100 invitations, update campaign end_at
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { end_at: true },
    });
    if (!campaign)
      throw new NotFoundException(`Campaign ${campaignId} not found`);

    // If batch 2 reaches 100 invitations AND end_at is null, update it
    if (currentBatchCount === 99 && batchId === 2 && campaign.end_at === null) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { end_at: new Date(), status: CampaignStatus.completed },
      });
      this.logger.log(`Campaign ${campaignId} end_at updated at ${new Date()}`);
    } else {
      this.logger.log(
        `Campaign ${campaignId} batch ${batchId} has ${currentBatchCount} invitations, end_at: ${campaign.end_at}`,
      );
    }
  }


  constructor(
    private prisma: PrismaService,
    private campaignMessagesService: CampaignMessagesService,
    private campaignInvitationService: CampaignInvitationService,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendInitialMessages() {
    this.logger.log("Process sending initial messages");
    const now = new Date();

    try {
      // Find pending invitations that haven't been sent yet
      // Fetch multiple to check batch readiness and promoter delays
      const pendingInvitations = await this.prisma.campaignInvitation.findMany({
        where: {
          AND: [
            { status: InvitationStatus.pending },
            {
              campaign: {
                status: { in: [CampaignStatus.active, CampaignStatus.draft] },
              },
            },
            {
              event: {
                dt: {
                  not: null,
                  gt: now,
                },
              },
            },
          ],
        },
        include: {
          campaign: true,
        },
        orderBy: { id: "asc" },
        take: 20, // Process up to 20 invitations per run
      });


      if (!pendingInvitations.length) {
        this.logger.log(
          "No pending invitations to process for initial messages",
        );
        return;
      }

      // Loop through invitations to find one that can be sent
      for (const invitation of pendingInvitations) {
        const promoterId = invitation.promoterId;
        // const campaignId = invitation.campaignId;
        // const batchId = invitation.batch;

        // // First check if the batch can start for this invitation
        // try {
        //   const canStart = await this.campaignInvitationService.canStartBatch(
        //     campaignId,
        //     batchId,
        //     Number(promoterId),
        //   );

        //   if (!canStart) {
        //     this.logger.debug(
        //       `Skipping invitation ${invitation.id} - batch ${batchId} cannot start yet`,
        //     );
        //     continue; // Try next invitation
        //   }
        // } catch (error) {
        //   this.logger.warn(
        //     `Error checking batch readiness for invitation ${invitation.id}:`,
        //     error,
        //   );
        //   continue; // Skip this invitation if batch check fails
        // }

        // // Then check if enough time has passed since last send for this promoter
        // const mode = process.env.MESSAGE_MODE || "dev";
        // const delayMinutes = mode === "dev" ? [1, 3] : [15, 20];

        // this.logger.log(`[Message Scheduler] Mode: ${mode}`);
        //  this.logger.log(`[Message Scheduler] Random delay range: ${delayMinutes[0]}–${delayMinutes[1]} minutes`);
        // if (!(await this.shouldSendMessage(promoterId,delayMinutes))) {
        //   this.logger.debug(
        //     `Skipping invitation ${invitation.id} for promoter ${promoterId}, waiting for random gap`,
        //   );
        //   continue; // Try next invitation
        // }

        // Both conditions met - send the message
        try {
          await this.sendInitialMessage(invitation);
          this.logger.log(
            `Sent initial message for invitation ${invitation.id}, promoter ${promoterId}`,
          );
          // Successfully sent one message, exit the loop
          //break;
        } catch (error) {
          this.logger.error(
            `Failed to send initial message for invitation ${invitation.id}:`,
            error,
          );
          // Continue to next invitation on error
        }
      }

      this.logger.log("Completed automation to send initial messages");
    } catch (error) {
      this.logger.error("Error in sendInitialMessages automation:", error);
    }
    this.logger.log("END Process sending initial messages");
  }

  async sendInitialMessage(
    invitation: Prisma.CampaignInvitationGetPayload<{
      include: { campaign: true };
    }>,
  ): Promise<void> {
    const campaign = invitation.campaign;
    const promoterId = invitation.promoterId;

    // Get related data
    const [talent, event] = await Promise.all([
      this.prisma.talentPool.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.events.findUnique({
        where: { id: invitation.eventId },
      }),
    ]);

    if (!campaign) {
      throw new Error(`Campaign with ID ${invitation.campaignId} not found`);
    }

    if (!talent) {
      throw new Error(`Talent with ID ${invitation.talentId} not found`);
    }

    if (!event) {
      this.logger.log(`[Initial message Skip] Event not found. invitationId=${invitation.id}, eventId=${invitation.eventId}`);
      return;
    }

    // Get talent's preferred language or default to 'en'
    let talentLang = talent.language || "en";

    const finalMessageContent = await this.getFinalTemplateContent({
      campaignId: campaign.id,
      templateType: TemplateType.invitation,
      talentLang,
    });

    if (!finalMessageContent) return;

    // Prepare template variables
    const variables = {
      name: talent.name,
      eventName: event.name,
      eventType: event.eventType || "",
      eventCity: event.city || "",
      eventDate: event.dt ? event.dt.toLocaleDateString() : "",
    };
    // Render the template with variables using handlebar
    // const message = renderTemplate(randomTemplate.content, variables);
    const message = renderTemplate(finalMessageContent, variables);
    // add logic for unsend if last reply is false 

    const lastReply = await this.prisma.campaignInvitation.findFirst({
      where: {
        talentId: talent.id,
        promoterId,
        hasReplied: false,
        thread_id: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (lastReply) {
      await this.campaignInvitationService.UnsendMessage(
        "token",
        lastReply.id
      );

      await this.prisma.campaignInvitation.update({
        where: {
          id: lastReply?.id,
        },
        data: {
          hasReplied: true,
        },
      });
      this.logger.log(`Processed for Unsend Last Message for invitation ${lastReply?.id}`)
    }


    const response = await this.sendMessageCommon({
      receiverId: talent.id,
      promoterId: invitation.promoterId,
      invitationId: invitation.id,
      message,
    });
    if (response) {
      let update = await this.prisma.campaignInvitation.update({
        where: {
          campaignId_talentId: {
            campaignId: campaign.id,
            talentId: talent.id,
          },
        },
        data: {
          thread_id: response.msg.threadId,
        },
      });

      this.logger.log("checking for Update Campaign Status END TIME");
      await this.checkAndUpdateCampaignEnd(update.campaignId, update.batch);


      this.logger.log("thread Id updated in campaign invitation");
    }

    // await this.campaignMessagesService.createMessage({
    //   campaignId: campaign.id,
    //   promoterId: Number(invitation.promoterId),
    //   invitationId: invitation.id,
    //   talentId: talent.id,
    //   direction: MessageDirection.sent,
    //   message: message,
    //   sentAt: new Date(),
    // });

    const UpdatedInviteMessage = await this.prisma.campaignInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.sent,
        invitationAt: new Date(),
      },
    });

    await updateUserTpStatus({
      userId: BigInt(promoterId),
      talentPoolId: talent.id,
      statusId: TP_STATUS_MAP.DM_SENT,
    });

    await this.updateTalentPromoterState({
      talentId: talent.id,
      promoterId: BigInt(promoterId),
      lastContacted: UpdatedInviteMessage.invitationAt ?? undefined,
    });

    this.logger.log(
      `Successfully sent initial message for invitation ${invitation.id}`,
    );
  }

  /**
   * Send followup messages to invitations with status "maybe" or who haven't replied
   * Runs every hour via cron
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendFollowupMessages() {
    this.logger.log("Process sending followup messages");
    const now = new Date();

    try {
      // Calculate the date 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Find invitations that need followup:
      // - followup = true (explicitly marked for followup)
      // - followupSent is false
      // - invitationAt is not null (initial message has been sent)
      // - invitationAt is at least 5 minutes ago

      const invitationsNeedingFollowup =
        await this.prisma.campaignInvitation.findMany({
          where: {
            AND: [
              { followup: true }, // no need
              { followupSent: false },
              {
                status: {
                  notIn: [
                    InvitationStatus.attended,
                    InvitationStatus.confirmed,
                    InvitationStatus.declined,
                    InvitationStatus.optout,
                  ],
                },
              },
              { invitationAt: { not: null, lte: fiveMinutesAgo } },
              {
                campaign: {
                  status: {
                    in: [
                      CampaignStatus.active, // follow up > 0
                      CampaignStatus.completed,
                    ],
                  },
                },
              },
              {
                event: {
                  dt: {
                    not: null,
                    gt: now,
                  },
                },
              },
            ],
          },
          include: {
            campaign: true,
          },
          orderBy: { id: "asc" },
          take: 10,
        });

      if (!invitationsNeedingFollowup.length) {
        this.logger.log("No invitations needing followup this run");
        return;
      }

      const invitation = invitationsNeedingFollowup[0];
      const promoterId = invitation.promoterId;

      const mode = process.env.MESSAGE_MODE || "dev";
      const delayMinutes = mode === "dev" ? [1, 3] : [15, 20];
      this.logger.log(`[Message Scheduler] Mode: ${mode}`);
      this.logger.log(
        `[Message Scheduler] Random delay range: ${delayMinutes[0]}–${delayMinutes[1]} minutes`,
      );

      // Check if enough time has passed since last send for this promoter
      if (!(await this.shouldSendMessage(promoterId, delayMinutes))) {
        this.logger.debug(
          `Skipping followup for promoter ${promoterId}, waiting for random gap for this invitation ${invitation.id}`,
        );
        return;
      }

      try {
        await this.sendFollowupMessage(invitation);
        this.logger.log(
          `Sent followup message for invitation ${invitation.id}, promoter ${promoterId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send followup message for invitation ${invitation.id}:`,
          error,
        );
      }

      this.logger.log("Completed automation to send followup messages");
    } catch (error) {
      this.logger.error("Error in sendFollowupMessages automation:", error);
    }
    this.logger.log("END Process sending followup messages");
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendFollowupMessagesWithDelay() {
    this.logger.log("Process sending followup messages with autoDelay");

    try {
      // Fetch invitations that are eligible for followup
      // Multiple invitations per run (batch)
      const invitationsNeedingFollowup =
        await this.prisma.campaignInvitation.findMany({
          where: {
            followup: false,
            followupSent: false,
            invitationAt: { not: null },
            campaign: { followup_delay: { gt: 0 } }, // Only campaigns with followup_delay > 0
            hasReplied: false,
          },
          include: { campaign: true },
          orderBy: { invitationAt: "asc" },
          take: 10, // Max 10 followups per run to avoid flooding
        });

      if (!invitationsNeedingFollowup.length) {
        this.logger.log("No invitations needing followup this run");
        return;
      }

      for (const invitation of invitationsNeedingFollowup) {
        const promoterId = invitation.promoterId;

        // Calculate dynamic followup time based on campaign.followup_delay
        const followupTime = new Date(
          invitation.invitationAt!.getTime() +
          invitation.campaign.followup_delay * 60 * 60 * 1000,
        );
        if (new Date() < followupTime) {
          // Not yet time to send followup
          this.logger.debug(
            `Breaking loop: followup time not reached for invitation ${invitation.id},`,
          );
          continue;
        }

        const mode = process.env.MESSAGE_MODE || "dev";
        const delayMinutes = mode === "dev" ? [1, 3] : [15, 20];
        this.logger.log(`[Message Scheduler] Mode: ${mode}`);
        this.logger.log(
          `[Message Scheduler] Random delay range: ${delayMinutes[0]}–${delayMinutes[1]} minutes`,
        );

        // Check promoter-specific rate limiting
        if (!(await this.shouldSendMessage(promoterId, delayMinutes))) {
          this.logger.debug(
            `Skipping followup for promoter ${promoterId}, waiting for random gap in delay for this invitation ${invitation.id}`,
          );
          continue;
        }

        // Try sending the follow-up with retry/backoff
        let attempts = 0;
        const maxAttempts = 3;
        const backoffDelay = 2000; // 2 seconds between retries

        while (attempts < maxAttempts) {
          try {
            await this.sendFollowupMessage(invitation);
            this.logger.log(
              `Sent followup message for invitation ${invitation.id}, promoter ${promoterId} in delay`,
            );
            break; // success → exit retry loop
          } catch (error) {
            attempts++;
            this.logger.error(
              `Attempt ${attempts} failed for invitation ${invitation.id}:`,
              error,
            );
            if (attempts < maxAttempts) {
              await new Promise((res) =>
                setTimeout(res, backoffDelay * attempts),
              ); // exponential backoff
            } else {
              this.logger.error(
                `Max retry attempts reached for invitation ${invitation.id}`,
              );
            }
          }
        }
      }

      this.logger.log("Completed automation to send followup messages");
    } catch (error) {
      this.logger.error("Error in sendFollowupMessages automation:", error);
    }

    this.logger.log("END Process sending followup messages");
  }

  async sendFollowupMessage(
    invitation: Prisma.CampaignInvitationGetPayload<{
      include: { campaign: true };
    }>,
  ): Promise<void> {
    const campaign = invitation.campaign;
    const promoterId = invitation.promoterId;

    // Get related data
    const [talent, event] = await Promise.all([
      this.prisma.talentPool.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.events.findUnique({
        where: { id: invitation.eventId },
      }),
    ]);

    if (!campaign) {
      throw new Error(`Campaign with ID ${invitation.campaignId} not found`);
    }

    if (!talent) {
      throw new Error(`Talent with ID ${invitation.talentId} not found`);
    }

    if (!event) {
      this.logger.log(`[Followup Skip] Event not found. invitationId=${invitation.id}, eventId=${invitation.eventId}`);
      return;
    }

    // Get talent's preferred language or default to 'en'
    let talentLang = talent.language || "en";

    const finalMessageContent = await this.getFinalTemplateContent({
      campaignId: campaign.id,
      templateType: TemplateType.followup,
      talentLang,
    });

    if (!finalMessageContent) return;

    // Prepare template variables
    const variables = {
      name: talent.name,
      eventName: event.name,
      eventType: event.eventType || "",
      eventCity: event.city || "",
      eventDate: event.dt ? event.dt.toLocaleDateString() : "",
    };
    // Render the template with variables using handlebar
    // const message = renderTemplate(randomTemplate.content, variables);
    const message = renderTemplate(finalMessageContent, variables);

    // Create the message entry

    await this.sendMessageCommon({
      receiverId: talent.id,
      promoterId: invitation.promoterId,
      invitationId: invitation.id,
      message,
    });

    // await this.campaignMessagesService.createMessage({
    //   campaignId: campaign.id,
    //   promoterId: Number(invitation.promoterId),
    //   invitationId: invitation.id,
    //   talentId: talent.id,
    //   direction: MessageDirection.sent,
    //   message: message,
    //   sentAt: new Date(),
    // });

    // Update the invitation to mark followup as sent
    await this.prisma.campaignInvitation.update({
      where: { id: invitation.id },
      data: {
        followupSent: true,
      },
    });

    await this.updateTalentPromoterState({
      talentId: talent.id,
      promoterId: BigInt(promoterId),
    });

    this.logger.log(
      `Successfully sent followup message for invitation ${invitation.id}`,
    );
  }

  /**
   * Send thank you messages after postEventTriggerAt has passed
   * Runs every minute via cron
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendThankYouMessages() {
    this.logger.log("Process sending thank you messages");

    try {
      // const now = new Date();
      const now = new Date();

      // Find invitations that need thank you messages:
      // - Campaign's postEventTriggerAt has passed
      // - thankYouSent is false
      // - status is "attended"
      const invitationsNeedingThankYou =
        await this.prisma.campaignInvitation.findMany({
          where: {
            AND: [
              { thankYouSent: false },
              { status: InvitationStatus.attended },
              // { thankyou: true},
              {
                campaign: {
                  status: {
                    in: [CampaignStatus.active, CampaignStatus.completed],
                  },
                  postEventTriggerAt: {
                    not: null,
                    lte: now, // less than or equal to now (has passed)
                  },
                },
              },
            ],
          },
          include: {
            campaign: true,
          },
          orderBy: { id: "asc" },
          take: 1,
        });

      if (!invitationsNeedingThankYou.length) {
        this.logger.log("No invitations needing thank you messages this run");
        return;
      }

      const invitation = invitationsNeedingThankYou[0];
      const promoterId = invitation.promoterId;

      const mode = process.env.MESSAGE_MODE || "dev";
      const delayMinutes = mode === "dev" ? [1, 3] : [15, 20];

      this.logger.log(`[Message Scheduler] Mode: ${mode}`);
      this.logger.log(
        `[Message Scheduler] Random delay range: ${delayMinutes[0]}–${delayMinutes[1]} minutes`,
      );

      // Check if enough time has passed since last send for this promoter
      if (!(await this.shouldSendMessage(promoterId, delayMinutes))) {
        this.logger.debug(
          `Skipping thank you for promoter ${promoterId}, waiting for random gap`,
        );
        return;
      }

      try {
        await this.sendThankYouMessage(invitation);
        this.logger.log(
          `Sent thank you message for invitation ${invitation.id}, promoter ${promoterId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send thank you message for invitation ${invitation.id}:`,
          error,
        );
      }

      this.logger.log("Completed automation to send thank you messages");
    } catch (error) {
      this.logger.error("Error in sendThankYouMessages automation:", error);
    }
    this.logger.log("END Process sending thank you messages");
  }

  async sendThankYouMessage(
    invitation: Prisma.CampaignInvitationGetPayload<{
      include: { campaign: true };
    }>,
  ): Promise<void> {
    const campaign = invitation.campaign;

    // Skip if postEventTriggerAt is not set
    if (!campaign.postEventTriggerAt) {
      this.logger.warn(
        `Campaign ${campaign.id} does not have postEventTriggerAt set, skipping thank you message`,
      );
      return;
    }

    // Get related data
    const [talent, event] = await Promise.all([
      this.prisma.talentPool.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.events.findUnique({
        where: { id: invitation.eventId },
      }),
    ]);

    if (!campaign) {
      throw new Error(`Campaign with ID ${invitation.campaignId} not found`);
    }

    if (!talent) {
      throw new Error(`Talent with ID ${invitation.talentId} not found`);
    }

    if (!event) {
      this.logger.log(`[Thank you message Skip] Event not found. invitationId=${invitation.id}, eventId=${invitation.eventId}`);
      return;
    }

    // Get talent's preferred language or default to 'en'
    let talentLang = talent.language || "en";

    const finalMessageContent = await this.getFinalTemplateContent({
      campaignId: campaign.id,
      templateType: TemplateType.postevent,
      talentLang,
    });

    if (!finalMessageContent) return;

    // Prepare template variables
    const variables = {
      name: talent.name,
      eventName: event.name,
      eventType: event.eventType || "",
      eventCity: event.city || "",
      eventDate: event.dt ? event.dt.toLocaleDateString() : "",
    };

    // Render the template with variables using handlebar
    const message = renderTemplate(finalMessageContent, variables);
    // const message = renderTemplate(randomTemplate.content, variables);

    await this.sendMessageCommon({
      receiverId: talent.id,
      promoterId: invitation.promoterId,
      invitationId: invitation.id,
      message,
    });

    // Create the message entry

    // await this.campaignMessagesService.createMessage({
    //   campaignId: campaign.id,
    //   promoterId: Number(invitation.promoterId),
    //   invitationId: invitation.id,
    //   talentId: talent.id,
    //   direction: MessageDirection.sent,
    //   message: message,
    //   sentAt: new Date(),
    // });

    // Update the invitation to mark thank you as sent
    await this.prisma.campaignInvitation.update({
      where: { id: invitation.id },
      data: {
        thankYouSent: true,
      },
    });

    await this.updateTalentPromoterState({
      talentId: talent.id,
      promoterId: BigInt(invitation.promoterId),
      trustScoreIncrement: 10,
      eventId: Number(invitation.eventId),
      scoreReason: "attended",
    });

    this.logger.log(
      `Successfully sent thank you message for invitation ${invitation.id}`,
    );
  }
}
