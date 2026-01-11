import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CampaignTemplateController } from './campaign-template.controller';
import { CampaignTemplateService } from './campaign-template.service';
import { CampaignTemplateListener } from './campaign-template.listener';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    OpenAIModule,
  ],
  controllers: [CampaignTemplateController],
  providers: [
    CampaignTemplateService,
    CampaignTemplateListener,
    PrismaService,
    JwtAuthGuard,
  ],
  exports: [CampaignTemplateService],
})
export class CampaignTemplateModule {}
