import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MessageDirection } from '@prisma/client';
import { OpenAIService } from '../openai/openai.service';
import { buildTrustScorePrompt } from './trustscore.config';

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
  ) {}

  /**
   * Cron job that runs periodically to analyze all unanalyzed campaign messages and update trust scores
   */
  @Cron(CronExpression.EVERY_HOUR)
  async analyzeAllMessages(): Promise<{ analyzed: number; updated: number }> {
    this.logger.log('Starting cron job: analyzeAllMessages');
    // Get all unanalyzed received messages
    const messages = await this.prisma.campaignMessage.findMany({
      where: {
        isScoreAnalyzed: false,
        direction: MessageDirection.received,
      },
      orderBy: {
        receivedAt: 'asc',
      },
    });

    this.logger.log(`Found ${messages.length} unanalyzed messages to process`);

    let analyzed = 0;
    let updated = 0;

    for (const message of messages) {
      try {
        const result = await this.analyzeMessage(message.id);
        if (result) {
          analyzed++;
          if (result.scoreChanged) {
            updated++;
          }
        }
      } catch (error) {
        this.logger.error(
          `Error analyzing message ${message.id}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(`Analyzed ${analyzed} messages, updated ${updated} trust scores`);
    this.logger.log('Completed cron job: analyzeAllMessages');

    return { analyzed, updated };
  }

  /**
   * Analyzes a single message and updates trust score if needed
   */
  async analyzeMessage(messageId: number): Promise<{ scoreChanged: boolean } | null> {
    const message = (await this.prisma.campaignMessage.findUnique({
      where: { id: messageId },
    })) as any;

    const campaign = (await this.prisma.campaign.findUnique({
      where: { id: message.campaignId },
      select: { eventId: true },
    })) as any;

    const analysisResult = await this.analyzeMessageContent(message.message);

    // Get or create TalentPromoterState
    let talentPromoterState = await this.prisma.talentPromoterState.findUnique({
      where: {
        talentId_promoterId: {
          talentId: message.talentId,
          promoterId: message.promoterId,
        },
      },
    });

    if (!talentPromoterState) {
      talentPromoterState = await this.prisma.talentPromoterState.create({
        data: {
          talentId: message.talentId,
          promoterId: message.promoterId,
          trustScore: 0,
          lastReply: message.receivedAt,
        },
      });
    } else {
      await this.prisma.talentPromoterState.update({
        where: { id: talentPromoterState.id },
        data: { lastReply: message.receivedAt },
      });
    }

    // Update trust score and create log entry using OpenAI result
    const newTrustScore = talentPromoterState.trustScore + analysisResult.score;
    const reason = analysisResult.reason;

    await this.prisma.$transaction([
      // Update trust score
      this.prisma.talentPromoterState.update({
        where: { id: talentPromoterState.id },
        data: { trustScore: newTrustScore },
      }),
      // Create log entry
      this.prisma.trustScoreLog.create({
        data: {
          talentId: message.talentId,
          promoterId: message.promoterId,
          eventId: campaign.eventId,
          change: analysisResult.score,
          reason: reason,
        },
      }),
      // Mark message as analyzed
      this.prisma.campaignMessage.update({
        where: { id: messageId },
        data: { isScoreAnalyzed: true },
      }),
    ]);

    this.logger.log(
      `Updated trust score for talent ${message.talentId}, promoter ${message.promoterId}: ${talentPromoterState.trustScore} -> ${newTrustScore} (${analysisResult.score > 0 ? '+' : ''}${analysisResult.score}) - ${reason}`,
    );

    return { scoreChanged: true };
  }

  /**
   * Analyzes message content using OpenAI and returns score and reason
   */
  private async analyzeMessageContent(messageText: string): Promise<{ score: number; reason: string }> {
    const prompt = buildTrustScorePrompt(messageText);
    const response = await this.openAIService.query(prompt);
    // Response is already parsed JSON
    return { score: response.score, reason: response.reason };
  }
}

