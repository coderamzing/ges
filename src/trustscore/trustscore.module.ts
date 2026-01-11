import { Module } from '@nestjs/common';
import { TrustScoreService } from './trustscore.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [OpenAIModule],
  providers: [TrustScoreService, PrismaService],
  exports: [TrustScoreService],
})
export class TrustScoreModule {}

