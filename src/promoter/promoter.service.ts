import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoterDto } from './promoter.dto';
import { UpdatePromoterDto } from './promoter.dto';
import { Promoter } from '@prisma/client';

@Injectable()
export class PromoterService {
  constructor(private prisma: PrismaService) {}

  async create(createPromoterDto: CreatePromoterDto): Promise<Promoter> {
    // Check if promoter with this email already exists
    const existingPromoter = await this.prisma.promoter.findUnique({
      where: { email: createPromoterDto.email },
    });

    if (existingPromoter) {
      throw new ConflictException(`Promoter with email ${createPromoterDto.email} already exists`);
    }

    return this.prisma.promoter.create({
      data: {
        email: createPromoterDto.email,
      },
    });
  }

  async update(id: number, updatePromoterDto: UpdatePromoterDto): Promise<Promoter> {
    // Check if promoter exists
    const promoter = await this.prisma.promoter.findUnique({
      where: { id },
    });

    if (!promoter) {
      throw new NotFoundException(`Promoter with ID ${id} not found`);
    }

    // If email is being updated, check if the new email already exists
    if (updatePromoterDto.email && updatePromoterDto.email !== promoter.email) {
      const existingPromoter = await this.prisma.promoter.findUnique({
        where: { email: updatePromoterDto.email },
      });

      if (existingPromoter) {
        throw new ConflictException(`Promoter with email ${updatePromoterDto.email} already exists`);
      }
    }

    const updateData: any = {};
    if (updatePromoterDto.email !== undefined) {
      updateData.email = updatePromoterDto.email;
    }

    return this.prisma.promoter.update({
      where: { id },
      data: updateData,
    });
  }
}

