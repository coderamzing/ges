import { Module } from '@nestjs/common';
import { PromoterController } from './promoter.controller';
import { PromoterService } from './promoter.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PromoterController],
  providers: [PromoterService, PrismaService],
  exports: [PromoterService],
})
export class PromoterModule {}

