import { Module } from '@nestjs/common';
import { CampaignMessagesAutomationService } from './campaign-messages.automation';
import { CampaignMessagesService } from './campaign-messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    OpenAIModule,
  ],
  providers: [
    CampaignMessagesAutomationService,
    CampaignMessagesService,
    PrismaService,
  ],
  exports: [CampaignMessagesService],
})
export class CampaignMessagesModule {}
