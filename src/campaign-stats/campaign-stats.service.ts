import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { CampaignStatsDto, BatchStatsDto } from './campaign-stats.dto';
import { EventDto } from 'src/event/event.dto';
import { InvitationStatus, type InvitationStatusType } from "src/campaign-invitation/campaign-invitation.config"
import { all } from 'axios';


@Injectable()
export class CampaignStatsService {
  constructor(
    private prisma: PrismaService,
    private campaignService: CampaignService,
  ) { }

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

    let event;
    let campaign;

    //  Try to find event directly (id = eventId)
    event = await this.prisma.events.findUnique({
      where: { id },
    });
    //  If event not found, treat id as campaignId
    if (!event) {
      campaign = await this.campaignService.findOne(id);

      if (!campaign) {
        throw new NotFoundException('Event or Campaign not found');
      }

      event = await this.prisma.events.findUnique({
        where: { id: campaign.eventId },
      });
    }

    //  Extra safety check
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${event?.id} does not belong to this promoter`,
      );
    }

    // //  promoter validation (if needed)
    // if (!event || event.userId?.toString() !== promoterId.toString()) {
    //   throw new NotFoundException('Event does not belong to promoter');
    // }


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

    // Build where clause for invitations based on batch filter
    // const invitationWhere: any = { campaignId: id };
    const invitationWhere: any = event
      ? { eventId: event.id }
      : { campaignId: id };
    if (batch !== undefined) {
      invitationWhere.batch = batch;
    } else {
      // Default: include batches 1 and 2
      invitationWhere.batch = { in: [1, 2] };
    }

    // Get invitations for this campaign (filtered by batch if provided)
    const invitations = await this.prisma.campaignInvitation.findMany({
      // where: invitationWhere,
      where: {
        ...invitationWhere,
        NOT: {
          status: {
            startsWith: 'manually',
          },
        },
      },
    });


    // Calculate totals from CampaignInvitation only
    const totalContacted = invitations.length;

    // Sent = invitations with status != pending
    const sent = invitations.filter(inv => inv.status !== InvitationStatus.INIT).length;

    // Delivered = invitations with status != pending (same as sent)
    const delivered = sent;

    // Replied = invitations where hasReplied is true
    const replied = invitations.filter(inv => inv.hasReplied === true).length;

    // Calculate response classification
    const confirmed = invitations.filter(inv => inv.status === InvitationStatus.CONFIRMED).length;
    const interested = invitations.filter(inv => inv.status === InvitationStatus.MAYBE).length;
    const declined = invitations.filter(inv => inv.status === InvitationStatus.DECLINED).length;
    // const pending = invitations.filter(inv => inv.status === InvitationStatus.INIT).length;
    // const pending = invitations.filter(inv => inv.status === InvitationStatus.PENDING).length;
    const pending = invitations.filter(
      inv => inv.status === InvitationStatus.INIT || inv.status === InvitationStatus.PENDING
    ).length;

    // Seen but no reply = invitations that are seen but haven't replied
    // const noReply = invitations.filter(inv =>
    //   inv.isSeen === true && inv.status === InvitationStatus.NOREPLY
    //   // inv.hasReplied === false
    // ).length;

    // fetch all type record
    const allInvitations = await this.prisma.campaignInvitation.findMany({
      where: invitationWhere,
    });
    const talentIdsAll = allInvitations.map(inv => inv.talentId);
    const talentsAll = await this.prisma.talentPool.findMany({
      where: {
        id: { in: talentIdsAll },
      },
      select: {
        id: true,
        genre: true,
      },
    });


    const filteredInvitations = allInvitations.filter(
      inv =>
        inv.status === InvitationStatus.CONFIRMED ||
        inv.status === InvitationStatus.MANUALLY_CONFIRM
    );
    const talentTypeMapAll = new Map(
      talentsAll.map(t => [t.id, t.genre])
    );
    const talentTypeCount: Record<string, number> = {};
    filteredInvitations.forEach(inv => {
      const type = talentTypeMapAll.get(inv.talentId) || 'unknown';
      talentTypeCount[type] = (talentTypeCount[type] || 0) + 1;
    });

    const manuallConfirmed = allInvitations.filter(invAll => invAll.status === InvitationStatus.MANUALLY_CONFIRM).length
    const manuallPending = allInvitations.filter(invAll => invAll.status === InvitationStatus.MANUALLY_PENDING).length
    const manuallDeclined = allInvitations.filter(invAll => invAll.status === InvitationStatus.MANUALLY_DECLINED).length
    const sentAll = allInvitations.filter(invAll => invAll.status === InvitationStatus.SENT).length

    const totalConfirm = manuallConfirmed + confirmed
    const totalPending = manuallPending + sentAll + interested
    const totalDeclined = manuallDeclined + declined

    const noReply = allInvitations.filter(invAll => invAll.status === InvitationStatus.NOREPLY || invAll.status === InvitationStatus.MANUALLY_NOREPLY).length
    const confirmationRate = Number(((totalConfirm / target) * 100).toFixed(3));
    const conversationRate = Number(((confirmed / sent) * 100).toFixed(3))


    // Calculate batch statistics (only for filtered batches)
    const batchMap = new Map<
      number,
      {
        invites: number;
        pendingInvites: number;
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
            pendingInvites: 0,
            sent: 0,
            delivered: 0,
            replied: 0,
            firstSentAt: undefined,
            lastSentAt: undefined,
          });
        }
        const batchStats = batchMap.get(batch)!;
        batchStats.invites++; // Total CampaignInvitation for that batch

        if (inv.status === InvitationStatus.INIT) {
          batchStats.pendingInvites++; // CampaignInvitation has status pending
        } else {
          // if (inv.status === InvitationStatus.SENT) {
          batchStats.sent++; // CampaignInvitation has status not == pending
          batchStats.delivered++; // CampaignInvitation has status not == pending
          // }
          if (inv.invitationAt) {
            if (!batchStats.firstSentAt || inv.invitationAt < batchStats.firstSentAt) {
              batchStats.firstSentAt = inv.invitationAt;
            }
            if (!batchStats.lastSentAt || inv.invitationAt > batchStats.lastSentAt) {
              batchStats.lastSentAt = inv.invitationAt;
            }
          }
        }

        if (inv.hasReplied === true) {
          batchStats.replied++; // CampaignInvitation hasReply == true for that batch
        }
      }
    });

    const now = new Date();

    // Convert batch map to array, compute estimations, and sort by batch number
    const batches: BatchStatsDto[] = Array.from(batchMap.entries())
      .map(([batchNumber, stats]) => {

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
        if (stats.pendingInvites > 0) {
          estimatedRemainingSeconds = Math.floor(
            (stats.pendingInvites * this.averageSendGapMs) / 1000,
          );
          const baseTime = stats.lastSentAt ?? now;
          estimatedCompletionAt = new Date(
            baseTime.getTime() + stats.pendingInvites * this.averageSendGapMs,
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
          pendingInvites: stats.pendingInvites,
          sent: stats.sent,
          delivered: stats.delivered,
          replied: stats.replied,
          sentAt: stats.firstSentAt,
          pending: pending,
          confirmed: confirmed,
          totalTimeSpentSeconds,
          estimatedRemainingSeconds,
          estimatedCompletionAt,
          expectedReplies,
        };
      })
      .sort((a, b) => a.batch - b.batch);

    const eventDto: EventDto = {
      id: Number(event.id),
      name: event.name ?? '',
      eventType: event.eventType ?? '',
      date: event.dt ?? undefined,
      city: event.city ?? undefined,
      guests: event.guests ?? undefined,
      userId: Number(event.userId),
    };

    return {
      event: eventDto,
      target,
      totalContacted,
      sent,
      delivered,
      replied,
      responseClassification: {
        confirmed,
        interested,
        declined,
        noReply,
        pending,
        confirmationRate,
        conversationRate,
        totalConfirm,
        totalPending,
        totalDeclined
      },
      batches,
      talentTypeCount,
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

