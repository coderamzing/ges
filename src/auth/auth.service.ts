import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, LoginResponseDto, MeResponseDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email } = loginDto;

    // Check if user exists with this email
    // Using type assertion because PrismaService extends PrismaClient
    // and TypeScript may not immediately recognize new models
    const user = await (this.prisma as any).user.findFirst({
      where: { username: email },
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

  async getCurrentUser(req): Promise<MeResponseDto> {
    const promoter = req.promoter;
    // const accessToken =
    //   req.headers.authorization?.replace('Bearer ', '') ?? '';
    const user = await this.prisma.user.findUnique({
      where: {
        id: BigInt(promoter.id),
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        city: true,
        status: true,
        userType: true,
        paid: true,
        approved: true,
        pictureUrl: true,
        createdAt: true,
        updatedAt: true,
        blockedUntil: true,
        proxy: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const payload = { sub: user.id.toString(), email: user.username };
    const refreshToken = this.jwtService.sign(
      {
        payload,
        type: 'refresh',
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
      },
    );
    return {
      access_token: refreshToken,
      user,
    };
  }









}

