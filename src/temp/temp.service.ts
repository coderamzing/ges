import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageDirection } from '@prisma/client';

@Injectable()
export class TempService {
  constructor(private prisma: PrismaService) {}

  async getCampaignMessages(campaignId: number) {
    // 1) Load all invitations for this campaign that have a linked DM thread
    const invitations = await this.prisma.campaignInvitation.findMany({
      where: {
        campaignId,
        thread_id: {
          not: null,
        },
      },
      select: {
        id: true,
        campaignId: true,
        eventId: true,
        promoterId: true,
        talentId: true,
        batch: true,
        status: true,
        invitationAt: true,
        isSeen: true,
        followupSent: true,
        thankYouSent: true,
        hasReplied: true,
        thread_id: true,
      },
    });

    if (!invitations.length) {
      return [];
    }

    // 2) Load legacy DM messages from the `message` table by thread_id
    const threadIds = Array.from(
      new Set(
        invitations
          .map((inv) => inv.thread_id)
          .filter((id): id is string => !!id),
      ),
    );

    const legacyMessages = await this.prisma.message.findMany({
      where: {
        thread_id: {
          in: threadIds,
        },
      },
      orderBy: {
        tm: 'asc',
      },
    });

    // Group messages by thread_id for fast lookup
    const messagesByThread = new Map<string, typeof legacyMessages>();
    for (const msg of legacyMessages) {
      if (!msg.thread_id) continue;
      if (!messagesByThread.has(msg.thread_id)) {
        messagesByThread.set(msg.thread_id, []);
      }
      messagesByThread.get(msg.thread_id)!.push(msg);
    }

    // 3) Load talents
    const talentIds = Array.from(
      new Set(invitations.map((inv) => inv.talentId)),
    );

    const talents = await this.prisma.talentPool.findMany({
      where: { id: { in: talentIds } },
      select: {
        id: true,
        name: true,
        profilePicture: true,
      },
    });

    const talentMap = new Map(talents.map((t) => [t.id, t]));

    // 4) Build response grouped by talent
    const result: any[] = [];

    for (const invitation of invitations) {
      const talent = talentMap.get(invitation.talentId) || {
        id: invitation.talentId,
        name: 'Unknown',
        profilePicture: null,
      };

      const threadMessages = invitation.thread_id
        ? messagesByThread.get(invitation.thread_id) || []
        : [];

      const mappedMessages = threadMessages.map((m) => {
        const isFromPromoter =
          m.sender !== null &&
          m.sender !== undefined &&
          invitation.promoterId !== null &&
          invitation.promoterId !== undefined &&
          m.sender.toString() === invitation.promoterId.toString();

        const direction = isFromPromoter
          ? MessageDirection.sent
          : MessageDirection.received;

        const timestamp = m.tm || m.created_at || null;

        return {
          id: m.id,
          campaignId: invitation.campaignId,
          promoterId: Number(invitation.promoterId),
          invitationId: invitation.id,
          talentId: invitation.talentId,
          direction,
          message: m.message ?? '',
          sentAt: isFromPromoter ? timestamp : null,
          receivedAt: !isFromPromoter ? timestamp : null,
        };
      });

      result.push({
        talent: {
          ...talent,
          // For UI convenience – use id as accountId when nothing else is available
          accountId: (talent as any).accountId ?? talent.id,
        },
        invitation: {
          id: invitation.id,
          status: invitation.status,
          batch: invitation.batch,
          invitationAt: invitation.invitationAt,
          isSeen: invitation.isSeen,
          followupSent: invitation.followupSent,
          thankYouSent: invitation.thankYouSent,
          hasReplied: invitation.hasReplied,
          threadId: invitation.thread_id,
        },
        messages: mappedMessages,
      });
    }

    return result;
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

  const promoter = await this.prisma.user.findUnique({
    where: {
      id: BigInt(promoterId),
    },
  });
  if (!promoter) {
    throw new NotFoundException('Promoter not found');
  }

  return this.prisma.message.create({
      data: {
        id: `${crypto.randomUUID()}`,
        created_at: now,
        dt: now,
        tm: now,
        message: message,
        sender: null,
        sender_username: talentId,
        receiver: BigInt(promoter.id),
        receiver_username: promoter.username,
        thread_id: thread.id,
        user_id: BigInt(promoter.id),
        invite: false,
        tmp: true,
        pending_reply: false,
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
