import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TalentBlacklistController } from './talent-blacklist.controller';
import { TalentBlacklistService } from './talent-blacklist.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';

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
  ],
  controllers: [TalentBlacklistController],
  providers: [TalentBlacklistService, PrismaService, JwtAuthGuard],
  exports: [TalentBlacklistService],
})
export class TalentBlacklistModule {}

