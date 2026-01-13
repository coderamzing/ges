import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, LoginResponseDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email } = loginDto;

    // Check if user exists with this email
    // Using type assertion because PrismaService extends PrismaClient
    // and TypeScript may not immediately recognize new models
    const user = await (this.prisma as any).user.findFirst({
      where: { username : email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or user not found');
    }

    // Generate JWT token with 7 days expiration
    // Convert BigInt to string for JWT payload
    const payload = { sub: user.id.toString(), email: user.username };
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      access_token,
    };
  }
}

