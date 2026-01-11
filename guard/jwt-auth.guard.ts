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

// Extend Express Request type to include promoter
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

      // Find promoter from database
      const promoter = await this.prisma.promoter.findUnique({
        where: { id: payload.sub },
      });

      if (!promoter) {
        throw new UnauthorizedException('Promoter not found');
      }

      // Attach promoter to request object
      request.promoter = {
        id: promoter.id,
        email: promoter.email,
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

