import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignMessage, MessageDirection } from '@prisma/client';
import { CreateMessageDto } from './campaign-messages.dto';

@Injectable()
export class CampaignMessagesService {
  private readonly logger = new Logger(CampaignMessagesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all messages for a campaign
   */
  async getCampaignMessages(campaignId: number): Promise<CampaignMessage[]> {
    return this.prisma.campaignMessage.findMany({
      where: { campaignId },
      orderBy: { sentAt: 'desc' },
    });
  }

  /**
   * Get messages for a specific talent in a campaign
   */
  async getTalentMessages(
    campaignId: number,
    talentId: string,
  ): Promise<CampaignMessage[]> {
    return this.prisma.campaignMessage.findMany({
      where: {
        campaignId,
        talentId,
      },
      orderBy: { sentAt: 'desc' },
    });
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: number): Promise<CampaignMessage | null> {
    return this.prisma.campaignMessage.findUnique({
      where: { id: messageId },
    });
  }

  /**
   * Create a new message (sent or received)
   */
  async createMessage(data: {
    campaignId: number;
    promoterId: number;
    invitationId: number;
    talentId: string;
    direction: MessageDirection;
    message: string;
    sentAt?: Date;
    receivedAt?: Date;
  }): Promise<CampaignMessage> {
    return this.prisma.campaignMessage.create({
      data: {
        campaignId: data.campaignId,
        promoterId: data.promoterId,
        invitationId: data.invitationId,
        talentId: data.talentId,
        direction: data.direction,
        message: data.message,
        sentAt: data.direction === MessageDirection.sent ? data.sentAt || new Date() : null,
        receivedAt: data.direction === MessageDirection.received ? data.receivedAt || new Date() : null,
      } as any,
    });
  }

  async createMessages(dto: CreateMessageDto) {
    const now = new Date();

    return this.prisma.message.create({
      data: {
        id: dto.id,
        created_at: now,
        dt: now,
        tm: now,
        message: dto.message,
        sender: dto.sender,
        sender_username: dto.sender_username,
        receiver: dto.receiver,
        receiver_username: dto.receiver_username,
        thread_id: dto.thread_id,
        invite: dto.invite ?? false,
        tmp: dto.tmp ?? false,
        pending_reply: dto.pending_reply ?? false,
        client_context: dto.client_context,
      },
    });
  }


  /**
   * Update a message
   */
  async updateMessage(
    messageId: number,
    data: {
      message?: string;
      sentAt?: Date;
      receivedAt?: Date;
      isScoreAnalyzed?: boolean;
    },
  ): Promise<CampaignMessage> {
    return this.prisma.campaignMessage.update({
      where: { id: messageId },
      data,
    });
  }

  /**
   * Get messages that need to be analyzed for trust score
   */
  async getUnanalyzedMessages(): Promise<CampaignMessage[]> {
    return this.prisma.campaignMessage.findMany({
      where: {
        isScoreAnalyzed: false,
        direction: MessageDirection.received,
      },
    });
  }

  /**
   * Mark messages as analyzed
   */
  async markAsAnalyzed(messageIds: number[]): Promise<void> {
    await this.prisma.campaignMessage.updateMany({
      where: {
        id: { in: messageIds },
      },
      data: {
        isScoreAnalyzed: true,
      },
    });
  }
}

