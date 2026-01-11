import { Module } from '@nestjs/common';
import { CampaignInvitationAutomationService } from './campaign-invitation.automation';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignMessagesModule } from '../campaign-messages/campaign-messages.module';

@Module({
  imports: [
    CampaignMessagesModule,
  ],
  providers: [
    CampaignInvitationAutomationService,
    PrismaService,
  ],
})
export class CampaignInvitationModule {}
