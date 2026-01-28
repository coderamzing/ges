import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";


@Injectable()
export class TalentAutomationService {
  private readonly logger = new Logger(TalentAutomationService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async  updateFutureCities(): Promise<void> {
  const now = new Date(new Date().toISOString());
  this.logger.log(`process update future location of talent`);
  try {
    const talents = await this.prisma.talentPool.findMany({
     
      where: {
        OR: [
          {
            futureCity: { not: null },
            futureCityStartAt: { lte: now },
          },
          {
            currentCity: { not: null },
            currentCityEndAt: { lt: now },
          },
        ],
      },
    });
    if (talents.length === 0) {
          this.logger.log(`No future cities to update at this time.`);
      return;
    }

    for (const talent of talents) {
      let currentCityEndAt = talent.currentCityEndAt;
      if(talent.futureCity){
        await this.prisma.talentPool.update({
          where: { id: talent.id },
          data: {
            currentCity: talent.futureCity,
            futureCity: null,
            futureCityStartAt: null,
            currentCityEndAt: talent.futureCityEndAt,
            futureCityEndAt: null, 
          }
        });
        this.logger.log(`Updated talent ${talent.id}: current_city set to ${talent.futureCity}`);
      }
      if(talent.currentCity && currentCityEndAt){
        if(currentCityEndAt < now){
          await this.prisma.talentPool.update({
            where: { id: talent.id },
            data: {
              currentCity: talent.cityHome?.trim() || talent.city,
              currentCityEndAt: null,
            }
          });
        }
        this.logger.log(`Updated talent ${talent.id}: current_city set to ${talent.cityHome?.trim() || talent.city}`);
      }

    }
  } catch (err) {
    console.error("Error updating future cities:", err);
  }
}

}