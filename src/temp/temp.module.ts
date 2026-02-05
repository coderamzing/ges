import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TempController } from './temp.controller';
import { TempService } from './temp.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';
import { CampaignInvitationService } from 'src/campaign-invitation/campaign-invitation.service';
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
  controllers: [TempController],
  providers: [TempService, PrismaService, JwtAuthGuard, CampaignInvitationService],
})
export class TempModule { }
