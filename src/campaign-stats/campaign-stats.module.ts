import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CampaignStatsController } from './campaign-stats.controller';
import { CampaignStatsService } from './campaign-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignModule } from '../campaign/campaign.module';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';

@Module({
  imports: [
    CampaignModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CampaignStatsController],
  providers: [CampaignStatsService, PrismaService, JwtAuthGuard],
  exports: [CampaignStatsService],
})
export class CampaignStatsModule {}

