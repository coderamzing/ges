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

  async getStats(id: number, promoterId: number): Promise<CampaignStatsDto> {
    // Check if campaign exists
    const campaign = await this.campaignService.findOne(id);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.event.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.promoterId !== promoterId) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    // Get all invitations for this campaign
    const invitations = await this.prisma.campaignInvitation.findMany({
      where: { campaignId: id },
    });

    // Get all messages for this campaign
    const messages = await this.prisma.campaignMessage.findMany({
      where: { campaignId: id },
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

    // Calculate batch statistics
    const batchMap = new Map<number, {
      invites: number;
      sent: number;
      delivered: number;
      replied: number;
      sentAt?: Date;
    }>();

    invitations.forEach(inv => {
      const batch = inv.batch;
      if (!batchMap.has(batch)) {
        batchMap.set(batch, {
          invites: 0,
          sent: 0,
          delivered: 0,
          replied: 0,
          sentAt: undefined,
        });
      }
      const batchStats = batchMap.get(batch)!;
      batchStats.invites++;
      if (inv.invitationAt) {
        batchStats.sent++;
        if (!batchStats.sentAt || inv.invitationAt < batchStats.sentAt) {
          batchStats.sentAt = inv.invitationAt;
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

    // Convert batch map to array and sort by batch number
    const batches: BatchStatsDto[] = Array.from(batchMap.entries())
      .map(([batch, stats]) => ({
        batch,
        invites: stats.invites,
        sent: stats.sent,
        delivered: stats.delivered,
        replied: stats.replied,
        sentAt: stats.sentAt,
      }))
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
}

