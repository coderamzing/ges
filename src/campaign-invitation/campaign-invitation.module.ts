import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CampaignInvitationAutomationService } from './campaign-invitation.automation';
import { CampaignInvitationService } from './campaign-invitation.service';
import { CampaignInvitationController } from './campaign-invitation.controller';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignMessagesModule } from '../campaign-messages/campaign-messages.module';
import { TalentModule } from '../talent/talent.module';

@Module({
  imports: [
    CampaignMessagesModule,
    TalentModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    CampaignInvitationController,
  ],
  providers: [
    CampaignInvitationAutomationService,
    CampaignInvitationService,
    PrismaService,
  ],
  exports: [
    CampaignInvitationService,
  ],
})
export class CampaignInvitationModule {}
