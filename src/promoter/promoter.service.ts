import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromoterService {
  constructor(private prisma: PrismaService) {}

  // Service methods can be added here if needed in the future
}

