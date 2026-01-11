import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageDirection } from '@prisma/client';

@Injectable()
export class TempService {
  constructor(private prisma: PrismaService) {}

  async getCampaignMessages(campaignId: number) {
    const messages = await this.prisma.campaignMessage.findMany({
      where: { campaignId },
      orderBy: [
        { sentAt: 'asc' },
        { receivedAt: 'asc' },
      ],
    });

    // Get talents
    const talentIds = [...new Set(messages.map(m => m.talentId))];
    const talents = await this.prisma.talent.findMany({
      where: { id: { in: talentIds } },
      select: {
        id: true,
        name: true,
        accountId: true,
        profilePic: true,
      },
    });

    const talentMap = new Map(talents.map(t => [t.id, t]));

    // Group by talent
    const messagesByTalent: any = {};
    messages.forEach(msg => {
      if (!messagesByTalent[msg.talentId]) {
        messagesByTalent[msg.talentId] = {
          talent: talentMap.get(msg.talentId),
          messages: [],
        };
      }
      messagesByTalent[msg.talentId].messages.push(msg);
    });

    return Object.values(messagesByTalent);
  }

  async sendTalentMessage(
    campaignId: number,
    talentId: number,
    message: string,
    promoterId: number,
  ) {
    const invitation = await this.prisma.campaignInvitation.findFirst({
      where: { campaignId, talentId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return this.prisma.campaignMessage.create({
      data: {
        campaignId,
        promoterId,
        invitationId: invitation.id,
        talentId,
        direction: MessageDirection.received,
        message,
        receivedAt: new Date(),
      } as any,
    });
  }

  async getTalentPromoterState(talentId: number, promoterId: number) {
    const state = await this.prisma.talentPromoterState.findUnique({
      where: {
        talentId_promoterId: {
          talentId,
          promoterId,
        },
      },
    });
    return state || {
      id: null,
      talentId,
      promoterId,
      trustScore: 0,
      lastContacted: null,
      lastReply: null,
      optedOut: false,
    };
  }

  async getTrustScoreLogs(talentId: number, promoterId: number) {
    return this.prisma.trustScoreLog.findMany({
      where: {
        talentId,
        promoterId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
