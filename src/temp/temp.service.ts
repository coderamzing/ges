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

    // Get talents (talentId in messages is now a string)
    const talentIds = [...new Set(messages.map(m => m.talentId))];
    const talents = await this.prisma.talentPool.findMany({
      where: { id: { in: talentIds } },
      select: {
        id: true,
        name: true,
        profilePicture: true,
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

  // async sendTalentMessage(
  //   campaignId: number,
  //   talentId: string,
  //   message: string,
  //   promoterId: number,
  // ) {
  //   const invitation = await this.prisma.campaignInvitation.findFirst({
  //     where: { campaignId, talentId },
  //   });

  //   if (!invitation) {
  //     throw new NotFoundException('Invitation not found');
  //   }

  //   return this.prisma.campaignMessage.create({
  //     data: {
  //       campaignId,
  //       promoterId: BigInt(promoterId),
  //       invitationId: invitation.id,
  //       talentId,
  //       direction: MessageDirection.received,
  //       message,
  //       receivedAt: new Date(),
  //     },
  //   });
  // }

  async sendTalentMessage(
  campaignId: number,
  talentId: string,
  message: string,
  promoterId: number,
) {
  const invitation = await this.prisma.campaignInvitation.findFirst({
    where: { campaignId, talentId },
  });

  if (!invitation) {
    throw new NotFoundException('Invitation not found');
  }


    if (!invitation.thread_id) {
    throw new NotFoundException('Thread not associated with invitation');
  }

  const thread = await this.prisma.thread.findFirst({
    where: {
      id:invitation.thread_id
    },
  });


  if (!thread) {
    throw new NotFoundException('Message thread not found');
  }
  const now = new Date();

  return this.prisma.message.create({
      data: {
        id: `msg_${crypto.randomUUID()}`,
        created_at: now,
        dt: now,
        tm: now,
        message: message,
        sender: null,
        sender_username: talentId,
        receiver: BigInt(promoterId),
        receiver_username: promoterId.toString(),
        thread_id: thread.id,
        invite: false,
        tmp: true,
        pending_reply: false,
        // client_context: 'talent_reply',
      },
    });
}


  async getTalentPromoterState(talentId: string, promoterId: number) {
    const state = await this.prisma.talentPromoterState.findUnique({
      where: {
        talentId_promoterId: {
          talentId,
          promoterId: BigInt(promoterId),
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

  async getTrustScoreLogs(talentId: string, promoterId: number) {
    return this.prisma.trustScoreLog.findMany({
      where: {
        talentId,
        promoterId: BigInt(promoterId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
