import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiPromptService } from './aiprompt.service';
import { AiPromptController } from './aiprompt.controller';
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
  controllers: [AiPromptController],
  providers: [
    AiPromptService,
    PrismaService,
    JwtAuthGuard,
  ],
  exports: [AiPromptService],
})
export class AiPromptModule {}
