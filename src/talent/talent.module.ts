import { Module } from '@nestjs/common';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TalentController],
  providers: [TalentService, PrismaService],
  exports: [TalentService],
})
export class TalentModule {}
