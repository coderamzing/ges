import { Module } from '@nestjs/common';
import { LocationAutomationService } from './location.automation';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    OpenAIModule,
  ],
  providers: [
    LocationAutomationService,
    PrismaService,
  ],
  exports: [],
})
export class LocationModule { }
