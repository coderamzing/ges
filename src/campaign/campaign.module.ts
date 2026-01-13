import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';
import { CampaignInvitationModule } from '../campaign-invitation/campaign-invitation.module';

@Module({
  imports: [
    CampaignInvitationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          'your-secret-key-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CampaignController],
  providers: [CampaignService, PrismaService, JwtAuthGuard],
  exports: [CampaignService],
})
export class CampaignModule {}
