import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { EventStatsModule } from './event-stats/event-stats.module';
import { CampaignModule } from './campaign/campaign.module';
import { CampaignStatsModule } from './campaign-stats/campaign-stats.module';
import { CampaignTemplateModule } from './campaign-template/campaign-template.module';
import { CampaignInvitationModule } from './campaign-invitation/campaign-invitation.module';
import { CampaignMessagesModule } from './campaign-messages/campaign-messages.module';
import { CampaignMembersModule } from './campaign-members/campaign-members.module';
import { HealthModule } from './health/health.module';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { TalentModule } from './talent/talent.module';
import { AuthModule } from './auth/auth.module';
import { PromoterModule } from './promoter/promoter.module';
import { TalentBlacklistModule } from './talend-blacklist/talent-blacklist.module';
import { TrustScoreModule } from './trustscore/trustscore.module';
import { TalentScoreModule } from './talend-score/talent-score.module';
import { QueueModule } from './queue/queue.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OpenAIModule } from './openai/openai.module';
import { TempModule } from './temp/temp.module';

import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 👈 makes ConfigService available everywhere
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(), // Register cron jobs here (only once)
    QueueModule,
    OpenAIModule,
    AuthModule,
    PromoterModule,
    EventModule, 
    EventStatsModule, 
    CampaignModule, 
    CampaignStatsModule,
    CampaignTemplateModule, 
    CampaignInvitationModule, 
    CampaignMessagesModule, 
    CampaignMembersModule, 
    HealthModule, 
    TalentModule,
    TalentBlacklistModule,
    TrustScoreModule,
    TalentScoreModule,
    TempModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
