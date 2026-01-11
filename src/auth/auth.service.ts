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

    // Check if promoter exists with this email
    const promoter = await this.prisma.promoter.findUnique({
      where: { email },
    });

    if (!promoter) {
      throw new UnauthorizedException('Invalid email or promoter not found');
    }

    // Generate JWT token with 7 days expiration
    const payload = { sub: promoter.id, email: promoter.email };
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      access_token,
    };
  }
}

