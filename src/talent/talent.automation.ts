import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";
import { Prisma } from "@prisma/client";


@Injectable()
export class TalentAutomationService {
  private readonly logger = new Logger(TalentAutomationService.name);
  // private prompt: any;

  constructor(
    private prisma: PrismaService,
    // private openAIService: OpenAIService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async  updateFutureCities(): Promise<void> {
  // const now = new Date();
  const now = new Date(new Date().toISOString());
  this.logger.log(`Cron process for update future location`);
  try {
    // Find all talents whose future_city should be activated
    const talents = await this.prisma.talentPool.findMany({
      where: {
        futureCity: { not: null },
        futureCityStartAt: { lte: now },
      },
    });

    if (talents.length === 0) {
          this.logger.log(`No future cities to update at this time.`);
      return;
    }

    for (const talent of talents) {
      await this.prisma.talentPool.update({
        where: { id: talent.id },
        data: {
          currentCity: talent.futureCity,
          futureCity: null,
          futureCityStartAt: null,
          currentCityEndAt: talent.futureCityEndAt,
          futureCityEndAt: null, 
        },
      });
   this.logger.log(`Updated talent ${talent.id}: current_city set to ${talent.futureCity}`);

    }
  } catch (err) {
    console.error("Error updating future cities:", err);
  }
}

}