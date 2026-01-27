import { Module } from '@nestjs/common';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { PrismaService } from '../prisma/prisma.service';
import { TalentAutomationService } from './talent.automation';

@Module({
  controllers: [TalentController],
  providers: [TalentService, PrismaService,TalentAutomationService],
  exports: [TalentService],
})
export class TalentModule {}
