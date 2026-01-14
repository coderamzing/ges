import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignInvitation, InvitationStatus } from '@prisma/client';
import { GetInvitationsQueryDto } from './campaign-invitation.dto';
import { AddTalentsToCampaignDto } from '../campaign/campaign.dto';

@Injectable()
export class CampaignInvitationService {
  constructor(private prisma: PrismaService) { }

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

  async getInvitationsByCampaign(
    campaignId: number,
    promoterId: number,
    filters?: GetInvitationsQueryDto,
  ): Promise<CampaignInvitation[]> {
    // Ensure campaign belongs to promoter
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    // Build where clause with filters
    const where: any = {
      campaignId,
    };

    // Apply status filter if provided
    if (filters?.status !== undefined) {
      where.status = filters.status;
    }

    // Apply hasReplied filter if provided
    if (filters?.hasReplied !== undefined) {
      where.hasReplied = filters.hasReplied;
    }

    return this.prisma.campaignInvitation.findMany({
      where,
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get invitations for a specific campaign and batch, with optional status/hasReplied filters.
   */
  async getInvitationsByCampaignAndBatch(
    campaignId: number,
    batchId: number,
    promoterId: number,
    filters?: GetInvitationsQueryDto,
  ): Promise<CampaignInvitation[]> {
    // Ownership check
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    const where: any = {
      campaignId,
      batch: batchId,
    };

    // Dynamically apply filters
    if (filters) {
      // if (filters.id !== undefined) {
      //   where.id = filters.id;
      // }

      if (filters?.status?.length) {
        where.status = {
          in: filters.status,
        };
      }

      if (filters.isSeen !== undefined) {
        where.isSeen = filters.isSeen;
      }

      if (filters.followupSent !== undefined) {
        where.followupSent = filters.followupSent;
      }

      if (filters.thankYouSent !== undefined) {
        where.thankYouSent = filters.thankYouSent;
      }

      if (filters.hasReplied !== undefined) {
        where.hasReplied = filters.hasReplied;
      }
    }

    return this.prisma.campaignInvitation.findMany({
      where,
      orderBy: { id: 'asc' },
    });
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
      orderBy: { id: 'asc' },
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
    const { campaign } = await this.ensureCampaignBelongsToPromoter(
      campaignId,
      promoterId,
    );

    // Use batchId from DTO or default to 1
    const batchId = addTalentsDto.batchId ?? 1;

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
        `Talents with IDs ${missingIds.join(', ')} not found`,
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

    // Enforce 100 invitation limit per batch + campaign
    if (currentBatchCount + newTalentIds.length > 100) {
      const remainingSlots = 100 - currentBatchCount;
      throw new BadRequestException(
        `Cannot add ${newTalentIds.length} invitations. Batch ${batchId} for this campaign already has ${currentBatchCount} invitations. Maximum is 100 invitations per batch. Only ${remainingSlots} slot(s) remaining.`,
      );
    }

    // Create new invitations
    await this.prisma.campaignInvitation.createMany({
      data: newTalentIds.map((talentId) => ({
        campaignId,
        eventId: campaign.eventId,
        promoterId: BigInt(promoterId),
        talentId,
        batch: batchId,
        status: InvitationStatus.pending,
      })),
    });

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
  async removeInvitation(
    campaignId: number,
    invitationId: number,
    promoterId: number,
  ): Promise<void> {
    await this.ensureCampaignBelongsToPromoter(campaignId, promoterId);

    // Check if invitation exists and belongs to the campaign
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

    await this.prisma.campaignInvitation.delete({
      where: { id: invitationId },
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
        `Some invitations not found or don't belong to this campaign: ${missingIds.join(', ')}`,
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
        `Some invitations not found or don't belong to this campaign: ${missingIds.join(', ')}`,
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
      },
    });

    if (totalPreviousBatch === 0) {
      return false;
    }

    // Get number of sent invitations in the previous batch
    const sentPreviousBatch = await this.prisma.campaignInvitation.count({
      where: {
        campaignId,
        batch: previousBatchId,
        status: InvitationStatus.sent,
      },
    });

    const percentageSent = sentPreviousBatch / totalPreviousBatch;

    // If less than 90% of previous batch is sent, we cannot start this batch
    if (percentageSent < 0.9) {
      return false;
    }

    // Find the last sent invitation timestamp in the previous batch
    const lastSentInvitation = await this.prisma.campaignInvitation.findFirst({
      where: {
        campaignId,
        batch: previousBatchId,
        invitationAt: {
          not: null,
        },
      },
      orderBy: {
        invitationAt: 'desc',
      },
      select: {
        invitationAt: true,
      },
    });

    // If we can't find a timestamp for the last sent message, consider it not ready
    if (!lastSentInvitation || !lastSentInvitation.invitationAt) {
      return false;
    }

    const now = new Date();
    const diffMs = now.getTime() - lastSentInvitation.invitationAt.getTime();
    const hoursSinceLastBatch1Sent = diffMs / (1000 * 60 * 60);

    // Less than 12h since last sent in previous batch → cannot start
    if (hoursSinceLastBatch1Sent < 12) {
      return false;
    }

    // All conditions satisfied → can start
    return true;
  }
}

