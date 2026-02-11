import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CampaignInvitation,
  CampaignStatus,
  InvitationStatus,
  TemplateType,
} from "@prisma/client";
import {
  AddTalentsToEventDto,
  GetCampaignInvitationsQueryDto,
  GetInvitationsQueryDto,
} from "./campaign-invitation.dto";
import { AddTalentsToCampaignDto } from "../campaign/campaign.dto";
import axios, { get } from "axios";
import { randomUUID } from "crypto";
import { SendMessageResponse } from "./campaign-invitation.types";
import { logger } from "handlebars";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DEFAULT_TEMPLATES } from "../campaign-template/campaign-template.config";
import { CAMPAIGN_TEMPLATE_SAVED_EVENT } from "../campaign-template/campaign-template.service";

@Injectable()
export class CampaignInvitationService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Ensure a campaign exists and belongs to the given promoter.
   * Returns the campaign and its event.
   */
  private async ensureCampaignBelongsToPromoter(
    campaignId: number,
    promoterId: number,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    return { campaign, event };
  }

  private async ensureActiveTemplatesForAllTypes(
    campaignId: number,
    requiredType: TemplateType,
  ) {
    const activeTemplates = await this.prisma.campaignTemplate.groupBy({
      by: ["type"],
      where: {
        campaignId,
        isActive: true,
      },
      _count: {
        id: true,
      },
    });

    const requiredTypes = Object.values(TemplateType);

    const missingTypes = requiredTypes.filter(
      (type) => !activeTemplates.some((t) => t.type === type),
    );

    if (missingTypes.length > 0) {
      throw new BadRequestException(
        `You must activate at least one ${requiredType} template language before performing this action`,
      );
    }
  }

  async getInvitationsByCampaign(
    campaignId: number,
    promoterId: number,
    filters?: GetCampaignInvitationsQueryDto,
  ): Promise<CampaignInvitation[]> {
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    const where: any = {
      campaignId,
    };

    if (filters?.status?.length) {
      where.status = { in: filters.status };
    }

    if (filters?.isSeen !== undefined) {
      where.isSeen = filters.isSeen;
    }

    if (filters?.followupSent !== undefined) {
      where.followupSent = filters.followupSent;
    }

    if (filters?.thankYouSent !== undefined) {
      where.thankYouSent = filters.thankYouSent;
    }

    if (filters?.hasReplied !== undefined) {
      where.hasReplied = filters.hasReplied;
    }

    return this.prisma.campaignInvitation.findMany({
      where,
      orderBy: {
        invitationAt: filters?.order ?? "desc",
      },
    });
  }

  async getInvitationsByCampaignAndBatch(
    campaignId: number,
    batchId: number,
    promoterId: number,
    filters?: GetInvitationsQueryDto,
  ) {
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    const where: any = {
      campaignId,
      batch: batchId,
    };

    if (filters) {
      if (filters?.status?.length) {
        where.status = { in: filters.status };
      }
      if (filters.isSeen !== undefined) where.isSeen = filters.isSeen;
      if (filters.followupSent !== undefined)
        where.followupSent = filters.followupSent;
      if (filters.thankYouSent !== undefined)
        where.thankYouSent = filters.thankYouSent;
      if (filters.hasReplied !== undefined)
        where.hasReplied = filters.hasReplied;
    }

    const orderBy = {
      invitationAt: filters?.order ?? "desc",
    };

    const invitations = await this.prisma.campaignInvitation.findMany({
      where,
      orderBy,
    });

    // Fetch related talent data in parallel
    const enrichedInvitations = await Promise.all(
      invitations.map(async (inv) => {
        const talentProfile = await this.prisma.talentPool.findUnique({
          where: { id: inv.talentId },
          select: {
            id: true,
            name: true,
            profilePicture: true,
            city: true,
            country: true,
            location: true,
            instagramLink: true,
          },
        });

        const promoterRating = await this.prisma.talentPromoterState.findUnique(
          {
            where: {
              talentId_promoterId: {
                talentId: inv.talentId,
                promoterId: promoterId,
              },
            },
            select: {
              trustScore: true,
              optedOut: true,
              lastContacted: true,
              lastReply: true,
            },
          },
        );

        return {
          ...inv,
          talent: talentProfile,
          promoterState: promoterRating,
        };
      }),
    );

    return enrichedInvitations;
  }

  /**
   * Get invitations for a campaign, optionally filtered by batch.
   * This mirrors the old CampaignService.getInvitations behaviour
   * but is centralized in the campaign-invitation module.
   */
  async getInvitationsForCampaign(
    campaignId: number,
    promoterId: number,
    batchId?: number,
  ): Promise<CampaignInvitation[]> {
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    const where: any = { campaignId };
    if (batchId !== undefined) {
      where.batch = batchId;
    }

    return this.prisma.campaignInvitation.findMany({
      where,
      orderBy: { id: "asc" },
    });
  }

  /**
   * Add talents to a campaign's invitations.
   * This is moved from CampaignService to live with other invitation logic.
   */
  async addTalentsToCampaign(
    campaignId: number,
    addTalentsDto: AddTalentsToCampaignDto,
    promoterId: number,
  ): Promise<CampaignInvitation[]> {
    const batchId = addTalentsDto.batchId ?? 1;

    if (batchId == 2) {
      let canStartBatch = await this.canStartBatch(
        campaignId,
        batchId,
        promoterId,
      );
      if (!canStartBatch) {
        throw new BadRequestException(
          "Cannot start batch 2. Previous batch is not completed.",
        );
      }
    }

    const { campaign } = await this.ensureCampaignBelongsToPromoter(
      campaignId,
      promoterId,
    );

    await this.ensureActiveTemplatesForAllTypes(
      campaignId,
      TemplateType.invitation,
    );

    // Use batchId from DTO or default to 1

    // Verify that all talents exist (talentIds are strings)
    const talents = await this.prisma.talentPool.findMany({
      where: {
        id: { in: addTalentsDto.talentIds },
      },
    });

    if (talents.length !== addTalentsDto.talentIds.length) {
      const foundIds = talents.map((t) => t.id);
      const missingIds = addTalentsDto.talentIds.filter(
        (id) => !foundIds.includes(id),
      );
      throw new BadRequestException(
        `Talents with IDs ${missingIds.join(", ")} not found`,
      );
    }

    // Check which invitations already exist (due to unique constraint on [campaignId, talentId])
    const existingInvitations = await this.prisma.campaignInvitation.findMany({
      where: {
        campaignId,
        talentId: { in: addTalentsDto.talentIds },
      },
      select: { talentId: true },
    });

    const existingTalentIds = existingInvitations.map((inv) => inv.talentId);
    const newTalentIds = addTalentsDto.talentIds.filter(
      (id) => !existingTalentIds.includes(id),
    );

    if (newTalentIds.length === 0) {
      return this.prisma.campaignInvitation.findMany({
        where: {
          campaignId,
          talentId: { in: addTalentsDto.talentIds },
        },
      });
    }

    // Check current count of invitations for this batch + campaign combination
    const currentBatchCount = await this.prisma.campaignInvitation.count({
      where: {
        campaignId,
        batch: batchId,
      },
    });

    if (currentBatchCount == 100) {
      throw new BadRequestException(
        ` NO slot(s) remaining for Batch ${batchId} for this campaign already has ${currentBatchCount} invitations.`,
      );
    }
    if (currentBatchCount + newTalentIds.length > 100) {
      const remainingSlots = 100 - currentBatchCount;
      throw new BadRequestException(
        `Cannot add ${newTalentIds.length} invitations. Batch ${batchId} for this campaign already has ${currentBatchCount} invitations. Maximum is 100 invitations per batch. Only ${remainingSlots} slot(s) remaining.`,
      );
    }

    // Create new invitations
    let invitation = await this.prisma.campaignInvitation.createMany({
      data: newTalentIds.map((talentId) => ({
        campaignId,
        eventId: Number(campaign.eventId),
        promoterId: Number(promoterId),
        talentId,
        batch: batchId,
        status: InvitationStatus.pending,
      })),
    });

    const countCheck = await this.prisma.campaignInvitation.count({
      where: {
        campaignId,
        batch: batchId,
      },
    });
    let event = await this.prisma.events.findFirst({
      where: {
        id: campaign.eventId,
      },
    });
    if (!event) {
      throw new NotFoundException(
        `Event not found with id ${campaign.eventId}`,
      );
    }

    const target = (() => {
      switch (event.mainEventType) {
        case 'Club Only':
          return event.clubGuests ?? 0;

        case 'Dinner Only':
          return event.dinnerGuests ?? 0;

        case 'Pre-Drink+Club':
          return (event.preDrinkGuests ?? 0) + (event.clubGuests ?? 0);

        case 'Dinner+Club':
          return (event.dinnerGuests ?? 0) + (event.clubGuests ?? 0);

        default:
          return 0;
      }
    })();

    let limit = target;
    if (countCheck >= limit && batchId === 1) {
      await this.prisma.campaign.updateMany({
        where: {
          id: campaignId,
          status: CampaignStatus.draft,
        },
        data: {
          status: CampaignStatus.active,
        },
      });
    }

    // Return all invitations (existing + newly created)
    return this.prisma.campaignInvitation.findMany({
      where: {
        campaignId,
        talentId: { in: addTalentsDto.talentIds },
      },
    });
  }

  /**
   * Remove a single invitation from a campaign.
   * This is moved from CampaignService.removeInvitation.
   */
  // async removeInvitation(
  //   campaignId: number,
  //   invitationId: number,
  //   promoterId: number,
  // ): Promise<void> {
  //   await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

  //   // Check if invitation exists and belongs to the campaign
  //   const invitation = await this.prisma.campaignInvitation.findUnique({
  //     where: { id: invitationId },
  //   });

  //   if (!invitation) {
  //     throw new NotFoundException(
  //       `Invitation with ID ${invitationId} not found`,
  //     );
  //   }

  //   if (invitation.campaignId !== campaignId) {
  //     throw new NotFoundException(
  //       `Invitation does not belong to this campaign`,
  //     );
  //   }

  //   await this.prisma.campaignInvitation.delete({
  //     where: { id: invitationId },
  //   });
  // }

  async removeInvitation(
    campaignId: number,
    invitationId: number,
    promoterId: number,
  ): Promise<{ message: string }> {
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    const invitation = await this.prisma.campaignInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException(
        `Invitation with ID ${invitationId} not found`,
      );
    }

    if (invitation.campaignId !== campaignId) {
      throw new NotFoundException(
        `Invitation does not belong to this campaign`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.campaignMessage.deleteMany({
        where: { invitationId },
      });

      await tx.campaignInvitation.delete({
        where: { id: invitationId },
      });
    });

    return {
      message: `Invitation ${invitationId} deleted successfully`,
    };
  }

  async updateInvitationStatus(
    campaignId: number,
    invitationId: number,
    promoterId: number,
    status: InvitationStatus,
  ) {
    const invitation = await this.prisma.campaignInvitation.findFirst({
      where: {
        id: invitationId,
        campaignId,
        promoterId: BigInt(promoterId),
      },
    });

    if (!invitation) {
      throw new NotFoundException(
        "Invitation not found or does not belong to this campaign/promoter",
      );
    }

    return this.prisma.campaignInvitation.update({
      where: { id: invitationId },
      data: { status },
    });
  }

  async markInvitationsAsAttended(
    campaignId: number,
    invitationIds: number[],
    promoterId: number,
  ): Promise<{ count: number; invitations: CampaignInvitation[] }> {
    // Check if campaign exists
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }
    // Verify that the event belongs to the promoter
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }
    await this.ensureActiveTemplatesForAllTypes(
      campaignId,
      TemplateType.postevent,
    );

    // Verify that all invitations exist and belong to the campaign
    const invitations = await this.prisma.campaignInvitation.findMany({
      where: {
        id: { in: invitationIds },
        campaignId: campaignId,
      },
    });
    if (invitations.length !== invitationIds.length) {
      const foundIds = invitations.map((inv) => inv.id);
      const missingIds = invitationIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Some invitations not found or don't belong to this campaign: ${missingIds.join(", ")}`,
      );
    }
    // Update all invitations to attended status
    const result = await this.prisma.campaignInvitation.updateMany({
      where: {
        id: { in: invitationIds },
        campaignId: campaignId,
      },
      data: {
        status: InvitationStatus.attended,
        // thankyou: true
      },
    });

    // Fetch updated invitations
    const updatedInvitations = await this.prisma.campaignInvitation.findMany({
      where: {
        id: { in: invitationIds },
      },
    });

    return {
      count: result.count,
      invitations: updatedInvitations,
    };
  }

  async markInvitationsForFollowup(
    campaignId: number,
    invitationIds: number[],
    promoterId: number,
  ): Promise<{ count: number; invitations: CampaignInvitation[] }> {
    // Check if campaign exists
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    await this.ensureActiveTemplatesForAllTypes(
      campaignId,
      TemplateType.followup,
    );

    // Verify that the event belongs to the promoter
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    // Verify that all invitations exist and belong to the campaign
    const invitations = await this.prisma.campaignInvitation.findMany({
      where: {
        id: { in: invitationIds },
        campaignId: campaignId,
      },
    });

    if (invitations.length !== invitationIds.length) {
      const foundIds = invitations.map((inv) => inv.id);
      const missingIds = invitationIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Some invitations not found or don't belong to this campaign: ${missingIds.join(", ")}`,
      );
    }

    // Update all invitations to set followup = true
    const result = await this.prisma.campaignInvitation.updateMany({
      where: {
        id: { in: invitationIds },
        campaignId: campaignId,
      },
      data: {
        followup: true,
      },
    });

    // Fetch updated invitations
    const updatedInvitations = await this.prisma.campaignInvitation.findMany({
      where: {
        id: { in: invitationIds },
      },
    });

    return {
      count: result.count,
      invitations: updatedInvitations,
    };
  }

  async addTalentsToEvent(dto: AddTalentsToEventDto, promoterId: number) {
    const { eventId, status, talentIds } = dto;

    const event = await this.prisma.events.findFirst({
      where: {
        id: eventId,
        userId: BigInt(promoterId),
      },
    });

    if (!event) {
      throw new NotFoundException("Event not found or not belongs to promoter");
    }

    if (event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(
        `Event with ID ${dto.eventId} does not belong to this promoter`,
      );
    }

    let campaign = await this.prisma.campaign.findFirst({
      where: {
        eventId: event.id,
      },
    });

    if (!campaign) {
      const created = await this.prisma.$transaction(async (tx) => {
        const createdCampaign = await tx.campaign.create({
          data: {
            eventId: event.id,
            name: event.name ?? "Untitled Campaign",
            status: CampaignStatus.active,
            lang: "en",
          },
        });

        const templates = await Promise.all(
          DEFAULT_TEMPLATES.map((template) =>
            tx.campaignTemplate.create({
              data: {
                campaignId: createdCampaign.id,
                lang: template.lang,
                type: template.type,
                name: template.name,
                content: template.content,
                isActive: template.isActive,
                batchId: template.batchId,
              },
            }),
          ),
        );

        return { campaign: createdCampaign, templates };
      });

      // Emit events AFTER transaction
      created.templates.forEach((template) => {
        this.eventEmitter.emit(CAMPAIGN_TEMPLATE_SAVED_EVENT, template.id);
      });

      campaign = created.campaign;
    }
    

    const results = await Promise.all(
      talentIds.map(async (talentId) => {
        const existing = await this.prisma.campaignInvitation.findFirst({
          where: {
            eventId,
            talentId,
          },
        });

        if (existing) {
          return this.prisma.campaignInvitation.update({
            where: { id: existing.id },
            data: {
              status,
            },
          });
        } else {
          return this.prisma.campaignInvitation.create({
            data: {
              campaignId: campaign.id,
              eventId,
              talentId,
              status,
              promoterId: BigInt(promoterId),
              batch : 1,
            },
          });
        }
      }),
    );

    return {
      message: "Talents processed successfully",
      count: results.length,
      data: results,
    };
  }

  /**
   * Check if a given batch can be started for a campaign.
   *
   * Rules:
   * - Batch 1 can always start (no dependency).
   * - For batch N > 1:
   *   - At least 90% of invitations from batch N-1 must have been sent
   *     (status = InvitationStatus.sent).
   *   - The last sent invitation in batch N-1 (by invitationAt) must be at
   *     least 12 hours ago.
   */
  async canStartBatch(
    campaignId: number,
    batchId: number,
    promoterId: number,
  ): Promise<boolean> {
    // Ensure the campaign belongs to the promoter (throws if not)
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    // Batch 1 has no prerequisites
    if (batchId === 1) {
      return true;
    }

    const previousBatchId = batchId - 1;

    // Get total invitations in the previous batch
    const totalPreviousBatch = await this.prisma.campaignInvitation.count({
      where: {
        campaignId,
        batch: previousBatchId,
        status: {
          not: "pending",
        },
      },
    });
    if (totalPreviousBatch < 100) {
      return false;
    }

    // Get number of sent invitations in the previous batch
    // const sentPreviousBatch = await this.prisma.campaignInvitation.count({
    //   where: {
    //     campaignId,
    //     batch: previousBatchId,
    //     status: InvitationStatus.sent,
    //   },
    // });

    // const percentageSent = sentPreviousBatch / totalPreviousBatch;

    // // If less than 90% of previous batch is sent, we cannot start this batch
    // if (percentageSent < 0.9) {
    //   return false;
    // }

    // // Find the last sent invitation timestamp in the previous batch
    // const lastSentInvitation = await this.prisma.campaignInvitation.findFirst({
    //   where: {
    //     campaignId,
    //     batch: previousBatchId,
    //     invitationAt: {
    //       not: null,
    //     },
    //   },
    //   orderBy: {
    //     invitationAt: 'desc',
    //   },
    //   select: {
    //     invitationAt: true,
    //   },
    // });

    // // If we can't find a timestamp for the last sent message, consider it not ready
    // if (!lastSentInvitation || !lastSentInvitation.invitationAt) {
    //   return false;
    // }

    // const now = new Date();
    // const diffMs = now.getTime() - lastSentInvitation.invitationAt.getTime();
    // const hoursSinceLastBatch1Sent = diffMs / (1000 * 60 * 60);

    // // Less than 12h since last sent in previous batch → cannot start
    // if (hoursSinceLastBatch1Sent < 12) {
    //   return false;
    // }

    // All conditions satisfied → can start
    return true;
  }

  async sendMessage(
    // token: string | null,
    receiverId: string, // sender
    message: string,
    senderId: number,
  ): Promise<SendMessageResponse | undefined> {
    try {
      const mode = process.env.MESSAGE_MODE || "dev";
      const url = process.env.CHATBOT_URL || "";
      const promoter = await this.prisma.user.findUnique({
        where: {
          id: BigInt(senderId),
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          city: true,
          status: true,
        },
      });

      if (!promoter) {
        throw new Error(`Promote with ${senderId} not found`);
      }
      if (mode === "live") {
        const response = await axios.post(url, {
          userId: promoter?.id,
          receiverUsername: receiverId,
          message,
        });
        return response.data;
      }
      if (mode === "dev") {
        const threadId = randomUUID();
        const messageId = randomUUID();
        const senderBigInt = BigInt(senderId);

        const now = new Date();
        const talent = await this.prisma.talentPool.findUnique({
          where: { id: receiverId },
        });

        if (!talent) {
          throw new Error(`Talent ${receiverId} not found`);
        }

        const talentPk = talent.pk;
        const thread = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.thread.findFirst({
            where: {
              user_id: senderBigInt,
              // pk2: talentPk,
              username2: String(talent.id),
            },
          });

          if (existing) {
            return tx.thread.update({
              where: { id: existing.id },
              data: {
                created_at: now,
              },
            });
          }

          return tx.thread.create({
            data: {
              id: threadId,
              created_at: now,
              pk1: talent.fromTrackerPk,
              pk2: talentPk,
              user_id: senderBigInt,
              username1: promoter?.username,
              username2: String(talent.id),
              name2: talent.name ?? null,
              picture2: talent.profilePicture ?? talent.mainPicture ?? null,
            },
          });
        });

        await this.prisma.message.create({
          data: {
            id: messageId,
            created_at: now,
            dt: now,
            tm: now,
            message,
            sender: senderBigInt,
            sender_username: promoter?.username,
            receiver: Number(talentPk),
            receiver_username: talent.id,
            thread_id: thread.id,
            invite: true,
            pending_reply: false,
            ai_processed: true,
            tmp: true,
            client_context: randomUUID(),
            user_id: senderId,
          },
        });

        return {
          message: "OK",
          msg: {
            id: messageId,
            userId: senderId,
            senderUsername: "promoter",
            receiverUsername: talent.id ?? receiverId,
            receiver: Number(talentPk),
            threadId: thread.id,
            message,
            dt: now.toISOString().split("T")[0],
            tm: now.toISOString(),
            createdAt: now.toISOString(),
            clientContext: randomUUID(),
          },
        };
      }
      throw new Error(`Invalid MESSAGE_MODE: ${process.env.MESSAGE_MODE}`);
    } catch (error: any) {
      throw new HttpException(
        error?.response?.data || "Failed to send message",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async UnsendMessage(
    token: string | null,
    invitationId: number,
  ): Promise<SendMessageResponse | undefined> {
    try {
      const fetchInvitation = await this.prisma.campaignInvitation.findFirst({
        where: { id: invitationId },
      });

      const findUnsendLastMessages = await this.prisma.message.findMany({
        where: {
          thread_id: fetchInvitation?.thread_id,
          created_at: {
            gte: fetchInvitation?.createdAt,
            lte: new Date(),
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });

      const mode = process.env.MESSAGE_MODE || "dev";
      const url = process.env.CHATBOT_UNSEND_MESSAGE || "";
      if (mode === "live") {
        for (const msg of findUnsendLastMessages) {
          const response = await axios.post(url, { id: msg.id });
          return response.data;
        }
      }
      if (mode === "dev") {
        await this.prisma.message.deleteMany({
          where: {
            thread_id: fetchInvitation?.thread_id,
            created_at: {
              gte: fetchInvitation?.createdAt,
              lte: new Date(),
            },
          },
        });
      }
      // throw new Error(`Error while Unsend Previous Message with invitation  ${fetchInvitation?.id}`);
    } catch (error: any) {
      throw new HttpException(
        error?.response?.data || "Failed to Unsend Message",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
