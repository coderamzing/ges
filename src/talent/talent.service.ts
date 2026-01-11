import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Talent } from '@prisma/client';

@Injectable()
export class TalentService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Talent[]> {
    return this.prisma.talent.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<Talent> {
    const talent = await this.prisma.talent.findUnique({
      where: { id },
    });

    if (!talent) {
      throw new NotFoundException(`Talent with ID ${id} not found`);
    }

    return talent;
  }
}

