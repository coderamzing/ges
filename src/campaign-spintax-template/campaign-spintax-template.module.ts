import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CampaignSpintaxTemplateController } from './campaign-spintax-template.controller';
import { CampaignSpintaxTemplateService } from './campaign-spintax-template.service';
import { CampaignSpintaxTemplateListener } from './campaign-spintax-template.listener';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';
import { OpenAIModule } from '../openai/openai.module';
import { CampaignTemplateModule } from '../campaign-template/campaign-template.module';

@Module({
  imports: [
    OpenAIModule,
    CampaignTemplateModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CampaignSpintaxTemplateController],
  providers: [
    CampaignSpintaxTemplateService,
    CampaignSpintaxTemplateListener,
    PrismaService,
    JwtAuthGuard,
  ],
  exports: [CampaignSpintaxTemplateService],
})
export class CampaignSpintaxTemplateModule {}

