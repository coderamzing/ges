import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { Request } from 'express';

// Extend Express Request type to include user (promoter)
declare module 'express' {
  interface Request {
    promoter?: {
      id: number;
      email: string;
    };
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Bearer token is missing');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production';
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      // Find user from database
      // payload.sub is a string (BigInt converted to string in JWT)
      // Using type assertion because PrismaService extends PrismaClient
      // and TypeScript may not immediately recognize new models
      const userId = BigInt(payload.sub);
      const user = await (this.prisma as any).user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Attach user to request object (keeping promoter name for backward compatibility)
      request.promoter = {
        id: Number(user.id), // Convert BigInt to number for compatibility
        email: user.email || '',
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

