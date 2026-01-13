import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { MessageDirection, InvitationStatus, CampaignMessage } from '@prisma/client';
import { MESSAGE_INTERPRETATION_PROMPT } from './campaign-messages.config';
import { renderTemplate } from 'utils/handlebar';

interface MessageInterpretationResponse {
  status: InvitationStatus;
  score: number;
  score_reason: string;
  current_location: string;
}

@Injectable()
export class CampaignMessagesAutomationService {
  private readonly logger = new Logger(CampaignMessagesAutomationService.name);

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
  ) {}

  /**
   * Process messages that haven't been interpreted yet
   * Groups by campaignId and talentId, and interprets them
   * Runs every minute via cron
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processLastMinuteMessages(): Promise<void> {
    try {
      // Find all messages that haven't been interpreted yet
      const messages = await this.prisma.campaignMessage.findMany({
        where: {
          isInterpret: false,
          direction: MessageDirection.received,
        },
        orderBy: {
          receivedAt: 'asc',
        },
        include: {
          invitation: true,
          campaign: true,
        } as any,
      });

      if (messages.length === 0) {
        this.logger.log('No new messages to process');
        return;
      }

      this.logger.log(`Found ${messages.length} messages to process`);
      
      for(const message of messages) {
          const threads = await this.prisma.campaignMessage.findMany({
            select: {
              message: true,
              receivedAt: true,
            },
            where: {
              invitationId: (message as any).invitationId || (message as any).invitation?.id,
              direction: MessageDirection.received,
            } as any,
            orderBy: {
              receivedAt: 'asc',
            },
          });

          const fullMessage = threads.map((msg) => msg.message).join('\n\n');
          await this.processTalentMessages(
            message as unknown as CampaignMessage & { invitation: { id: number; promoterId: bigint; eventId: number; campaignId: number; talentId: string } | null },
            fullMessage
          );
      }
    } catch (error) {
      this.logger.error('Error processing last minute messages:', error);
      throw error;
    }
  }

  /**
   * Process messages for a specific talent in a campaign
   */
  private async processTalentMessages(
    message: CampaignMessage & { invitation: { id: number; promoterId: bigint; eventId: number; campaignId: number; talentId: string } | null },
    fullMessage: string
  ): Promise<void> {
    try {
      // Use the invitation relation from the message
      const invitation = message.invitation;
      if (!invitation) {
        this.logger.warn(`No invitation found for message ${message.id}`);
        return;
      }
      const { promoterId, eventId, campaignId, talentId } = invitation;
      const invitationId = invitation.id;

      // Prepare the prompt
      const prompt = renderTemplate(MESSAGE_INTERPRETATION_PROMPT, { messages: fullMessage });

      // Call OpenAI to interpret
      let interpretation: MessageInterpretationResponse;
      try {
        const response = await this.openAIService.query(prompt);
        interpretation = {
          status: this.mapStatusToEnum(response.status),
          score: response.score || 0,
          score_reason: response.score_reason || 'neutral_reply',
          current_location: response.current_location || 'default',
        };
      } catch (error) {
        this.logger.error(
          `Error calling OpenAI for campaign ${invitation.campaignId}, talent ${invitation.talentId}:`,
          error,
        );
        // Use default values if OpenAI fails
        return;
      }

      // Update CampaignInvitation status and mark as replied using invitationId
      await this.prisma.campaignInvitation.update({
        where: {
          id: invitationId,
        },
        data: {
          status: interpretation.status,
          hasReplied: true,
        },
      });

      // Get or create TalentPromoterState
      let talentPromoterState = await this.prisma.talentPromoterState.findUnique({
        where: {
          talentId_promoterId: {
            talentId,
            promoterId: BigInt(promoterId),
          },
        },
      });

      if (!talentPromoterState) {
        talentPromoterState = await this.prisma.talentPromoterState.create({
          data: {
            talentId,
            promoterId: BigInt(promoterId),
            trustScore: 0,
            lastReply: new Date(),
          },
        });
      }

      // Update trust score
      const newTrustScore = talentPromoterState.trustScore + interpretation.score;
      const lastReceivedAt = message.receivedAt || new Date();

      await this.prisma.talentPromoterState.update({
        where: {
          talentId_promoterId: {
            talentId,
            promoterId: BigInt(promoterId),
          },
        },
        data: {
          trustScore: newTrustScore,
          lastReply: lastReceivedAt,
        },
      });

      // Create TrustScoreLog entry
      await this.prisma.trustScoreLog.create({
        data: {
          talentId,
          promoterId: BigInt(promoterId),
          eventId,
          change: interpretation.score,
          reason: interpretation.score_reason,
        },
      });

      // Update talent's current location if provided and different from default
      if (interpretation.current_location && interpretation.current_location !== 'default') {
        await this.prisma.talentPool.update({
          where: { id: talentId },
          data: {
            currentCity: interpretation.current_location,
          },
        });
      }

      // Mark messages as interpreted - update all messages for this invitation
      await this.prisma.campaignMessage.updateMany({
        where: {
          invitationId: invitationId,
          direction: MessageDirection.received,
          isInterpret: false,
        } as any,
        data: {
          isInterpret: true,
          isScoreAnalyzed: true,
        },
      });

      this.logger.log(
        `Processed messages for campaign ${campaignId}, talent ${talentId}. Status: ${interpretation.status}, Score: ${interpretation.score}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing message ${message.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Map string status to InvitationStatus enum
   */
  private mapStatusToEnum(status: string): InvitationStatus {
    const statusMap: Record<string, InvitationStatus> = {
      confirmed: InvitationStatus.confirmed,
      declined: InvitationStatus.declined,
      maybe: InvitationStatus.maybe,
      ignored: InvitationStatus.ignored,
      pending: InvitationStatus.pending,
      attended: InvitationStatus.attended,
    };

    return statusMap[status.toLowerCase()] || InvitationStatus.pending;
  }
}