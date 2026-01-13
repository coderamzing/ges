import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { CampaignStatsDto, BatchStatsDto } from './campaign-stats.dto';
import { InvitationStatus, MessageDirection } from '@prisma/client';

@Injectable()
export class CampaignStatsService {
  constructor(
    private prisma: PrismaService,
    private campaignService: CampaignService,
  ) {}

  // Average gap between messages in milliseconds, based on automation (1–3 minutes random gap)
  private readonly averageSendGapMs = 2 * 60 * 1000; // 2 minutes

  /**
   * Internal helper to build stats, optionally filtered by batch.
   * When batch is undefined, it aggregates batches 1 and 2.
   */
  private async buildStats(
    id: number,
    promoterId: number,
    batch?: number,
  ): Promise<CampaignStatsDto> {
    // Check if campaign exists
    const campaign = await this.campaignService.findOne(id);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    // Build where clause for invitations based on batch filter
    const invitationWhere: any = { campaignId: id };
    if (batch !== undefined) {
      invitationWhere.batch = batch;
    } else {
      // Default: include batches 1 and 2
      invitationWhere.batch = { in: [1, 2] };
    }

    // Get invitations for this campaign (filtered by batch if provided)
    const invitations = await this.prisma.campaignInvitation.findMany({
      where: invitationWhere,
    });

    // Get talent IDs from filtered invitations to filter messages
    const talentIds = invitations.map(inv => inv.talentId);

    // Get messages for this campaign, filtered by talent IDs from filtered invitations
    const messages = await this.prisma.campaignMessage.findMany({
      where: {
        campaignId: id,
        talentId: { in: talentIds },
      },
    });

    // Calculate totals
    const totalContacted = invitations.length;
    const sent = invitations.filter(inv => inv.invitationAt !== null).length;
    const sentMessages = messages.filter(msg => msg.direction === MessageDirection.sent);
    const delivered = sentMessages.length;
    const receivedMessages = messages.filter(msg => msg.direction === MessageDirection.received);
    const replied = receivedMessages.length;

    // Calculate response classification
    const confirmed = invitations.filter(inv => inv.status === InvitationStatus.confirmed).length;
    const interested = invitations.filter(inv => inv.status === InvitationStatus.maybe).length;
    const declined = invitations.filter(inv => inv.status === InvitationStatus.declined).length;
    
    // Get talent IDs that have received messages
    const repliedTalentIds = new Set(receivedMessages.map(msg => msg.talentId));
    const seenNoReply = invitations.filter(inv => 
      inv.isSeen && !repliedTalentIds.has(inv.talentId)
    ).length;

    // Calculate batch statistics (only for filtered batches)
    const batchMap = new Map<
      number,
      {
        invites: number;
        sent: number;
        delivered: number;
        replied: number;
        firstSentAt?: Date;
        lastSentAt?: Date;
      }
    >();

    invitations.forEach(inv => {
      const batch = inv.batch;
      // Only process batches 1 or 2 (skip followup batch if any)
      if (batch === 1 || batch === 2) {
        if (!batchMap.has(batch)) {
          batchMap.set(batch, {
            invites: 0,
            sent: 0,
            delivered: 0,
            replied: 0,
            firstSentAt: undefined,
            lastSentAt: undefined,
          });
        }
        const batchStats = batchMap.get(batch)!;
        batchStats.invites++;
        if (inv.invitationAt) {
          batchStats.sent++;
          if (!batchStats.firstSentAt || inv.invitationAt < batchStats.firstSentAt) {
            batchStats.firstSentAt = inv.invitationAt;
          }
          if (!batchStats.lastSentAt || inv.invitationAt > batchStats.lastSentAt) {
            batchStats.lastSentAt = inv.invitationAt;
          }
        }
      }
    });

    // Count delivered and replied per batch
    sentMessages.forEach(msg => {
      const invitation = invitations.find(inv => inv.talentId === msg.talentId);
      if (invitation) {
        const batchStats = batchMap.get(invitation.batch);
        if (batchStats) {
          batchStats.delivered++;
        }
      }
    });

    receivedMessages.forEach(msg => {
      const invitation = invitations.find(inv => inv.talentId === msg.talentId);
      if (invitation) {
        const batchStats = batchMap.get(invitation.batch);
        if (batchStats) {
          batchStats.replied++;
        }
      }
    });

    const now = new Date();

    // Convert batch map to array, compute estimations, and sort by batch number
    const batches: BatchStatsDto[] = Array.from(batchMap.entries())
      .map(([batchNumber, stats]) => {
        const pendingInvites = stats.invites - stats.sent;

        let totalTimeSpentSeconds: number | null = null;
        if (stats.firstSentAt && stats.lastSentAt && stats.lastSentAt > stats.firstSentAt) {
          totalTimeSpentSeconds = Math.floor(
            (stats.lastSentAt.getTime() - stats.firstSentAt.getTime()) / 1000,
          );
        } else if (stats.firstSentAt && stats.sent > 0) {
          // Only one message sent so far – treat time spent as 0 for now
          totalTimeSpentSeconds = 0;
        }

        let estimatedRemainingSeconds: number | null = null;
        let estimatedCompletionAt: Date | null = null;
        if (pendingInvites > 0) {
          estimatedRemainingSeconds = Math.floor(
            (pendingInvites * this.averageSendGapMs) / 1000,
          );
          const baseTime = stats.lastSentAt ?? now;
          estimatedCompletionAt = new Date(
            baseTime.getTime() + pendingInvites * this.averageSendGapMs,
          );
        }

        // Expected replies based on current reply rate for this batch
        let expectedReplies: number | null = null;
        if (stats.sent > 0) {
          const replyRate = stats.replied / stats.sent;
          expectedReplies = Math.round(replyRate * stats.invites);
        }

        return {
          batch: batchNumber,
          invites: stats.invites,
          pendingInvites,
          sent: stats.sent,
          delivered: stats.delivered,
          replied: stats.replied,
          sentAt: stats.firstSentAt,
          totalTimeSpentSeconds,
          estimatedRemainingSeconds,
          estimatedCompletionAt,
          expectedReplies,
        };
      })
      .sort((a, b) => a.batch - b.batch);

    return {
      totalContacted,
      sent,
      delivered,
      replied,
      responseClassification: {
        confirmed,
        interested,
        declined,
        seenNoReply,
      },
      batches,
    };
  }

  /**
   * Get full campaign statistics aggregating batches 1 and 2.
   */
  async getStats(id: number, promoterId: number): Promise<CampaignStatsDto> {
    return this.buildStats(id, promoterId);
  }

  /**
   * Get statistics for a single batch (1 or 2) of a campaign.
   * Reuses the same calculation logic as getStats.
   */
  async getStatsForBatch(
    id: number,
    promoterId: number,
    batch: number,
  ): Promise<CampaignStatsDto> {
    if (batch !== 1 && batch !== 2) {
      throw new NotFoundException('Batch must be 1 or 2');
    }
    return this.buildStats(id, promoterId, batch);
  }
}

