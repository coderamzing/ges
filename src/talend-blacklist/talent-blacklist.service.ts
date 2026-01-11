import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTalentBlacklistDto } from './talent-blacklist.dto';
import { UpdateTalentBlacklistDto } from './talent-blacklist.dto';
import { TalentBlacklist } from '@prisma/client';

@Injectable()
export class TalentBlacklistService {
  constructor(private prisma: PrismaService) {}

  async create(createTalentBlacklistDto: CreateTalentBlacklistDto, promoterId: number): Promise<TalentBlacklist> {
    // Check if talent exists
    const talent = await this.prisma.talent.findUnique({
      where: { id: createTalentBlacklistDto.talentId },
    });

    if (!talent) {
      throw new NotFoundException(`Talent with ID ${createTalentBlacklistDto.talentId} not found`);
    }

    // Check if already blacklisted (using unique constraint check)
    const existing = await this.prisma.talentBlacklist.findUnique({
      where: {
        talentId_promoterId: {
          talentId: createTalentBlacklistDto.talentId,
          promoterId: promoterId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Talent is already blacklisted by this promoter');
    }

    return this.prisma.talentBlacklist.create({
      data: {
        talentId: createTalentBlacklistDto.talentId,
        promoterId: promoterId,
        reason: createTalentBlacklistDto.reason,
      },
    });
  }

  async findByPromoter(promoterId: number): Promise<TalentBlacklist[]> {
    return this.prisma.talentBlacklist.findMany({
      where: { promoterId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number, promoterId: number): Promise<TalentBlacklist> {
    const blacklistEntry = await this.prisma.talentBlacklist.findUnique({
      where: { id },
    });

    if (!blacklistEntry) {
      throw new NotFoundException(`Blacklist entry with ID ${id} not found`);
    }

    if (blacklistEntry.promoterId !== promoterId) {
      throw new ForbiddenException('You do not have access to this blacklist entry');
    }

    return blacklistEntry;
  }

  async findByTalentAndPromoter(talentId: number, promoterId: number): Promise<TalentBlacklist | null> {
    return this.prisma.talentBlacklist.findUnique({
      where: {
        talentId_promoterId: {
          talentId,
          promoterId,
        },
      },
    });
  }

  async update(id: number, updateTalentBlacklistDto: UpdateTalentBlacklistDto, promoterId: number): Promise<TalentBlacklist> {
    // Check if entry exists and belongs to promoter
    await this.findOne(id, promoterId);

    const updateData: any = {};
    if (updateTalentBlacklistDto.reason !== undefined) {
      updateData.reason = updateTalentBlacklistDto.reason;
    }

    return this.prisma.talentBlacklist.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number, promoterId: number): Promise<void> {
    // Check if entry exists and belongs to promoter
    await this.findOne(id, promoterId);

    await this.prisma.talentBlacklist.delete({
      where: { id },
    });
  }

  async removeByTalentAndPromoter(talentId: number, promoterId: number): Promise<void> {
    const blacklistEntry = await this.findByTalentAndPromoter(talentId, promoterId);
    
    if (!blacklistEntry) {
      throw new NotFoundException('Talent is not blacklisted by this promoter');
    }

    await this.prisma.talentBlacklist.delete({
      where: {
        talentId_promoterId: {
          talentId,
          promoterId,
        },
      },
    });
  }
}

