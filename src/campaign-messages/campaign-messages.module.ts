import { Module } from '@nestjs/common';
import { CampaignMessagesAutomationService } from './campaign-messages.automation';
import { CampaignMessagesService } from './campaign-messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIModule } from '../openai/openai.module';
import { TalentBlacklistService } from 'src/talend-blacklist/talent-blacklist.service';

@Module({
  imports: [
    OpenAIModule,
  ],
  providers: [
    CampaignMessagesAutomationService,
    CampaignMessagesService,
    PrismaService,
    TalentBlacklistService
  ],
  exports: [CampaignMessagesService],
})
export class CampaignMessagesModule { }
