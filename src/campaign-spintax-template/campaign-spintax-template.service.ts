import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignSpintaxTemplateDto } from './campaign-spintax-template.dto';
import { UpdateCampaignSpintaxTemplateDto } from './campaign-spintax-template.dto';
import { CampaignSpintaxTemplate, TemplateType } from '@prisma/client';

@Injectable()
export class CampaignSpintaxTemplateService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateCampaignSpintaxTemplateDto,
  ): Promise<CampaignSpintaxTemplate> {
    // Verify that the campaign exists
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: createDto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Campaign with ID ${createDto.campaignId} not found`,
      );
    }

    // Verify that the campaign template exists
    const template = await this.prisma.campaignTemplate.findUnique({
      where: { id: createDto.CampaignTemplateId },
    });

    if (!template) {
      throw new NotFoundException(
        `CampaignTemplate with ID ${createDto.CampaignTemplateId} not found`,
      );
    }

    return this.prisma.campaignSpintaxTemplate.create({
      data: {
        CampaignTemplateId: createDto.CampaignTemplateId,
        campaignId: createDto.campaignId,
        lang: createDto.lang,
        type: createDto.type,
        name: createDto.name,
        content: createDto.content,
        batch: createDto.batch ?? 1,
      } as any,
    });
  }

  async findByCampaign(
    campaignId: number,
    type?: TemplateType,
    lang?: string,
    batch?: number,
  ): Promise<CampaignSpintaxTemplate[]> {
    const where: any = { campaignId };

    if (type) {
      where.type = type;
    }

    if (lang) {
      where.lang = lang;
    }

    if (batch !== undefined) {
      where.batch = batch;
    }

    return this.prisma.campaignSpintaxTemplate.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<CampaignSpintaxTemplate> {
    const spintax = await this.prisma.campaignSpintaxTemplate.findUnique({
      where: { id },
    });

    if (!spintax) {
      throw new NotFoundException(
        `CampaignSpintaxTemplate with ID ${id} not found`,
      );
    }

    return spintax;
  }

  async update(
    id: number,
    updateDto: UpdateCampaignSpintaxTemplateDto,
  ): Promise<CampaignSpintaxTemplate> {
    // Check if spintax exists
    const spintax = await this.findOne(id);

    // Verify campaign if campaignId is being updated
    if (updateDto.campaignId !== undefined) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: updateDto.campaignId },
      });

      if (!campaign) {
        throw new NotFoundException(
          `Campaign with ID ${updateDto.campaignId} not found`,
        );
      }
    }

    // Verify campaign template if CampaignTemplateId is being updated
    if (updateDto.CampaignTemplateId !== undefined) {
      const template = await this.prisma.campaignTemplate.findUnique({
        where: { id: updateDto.CampaignTemplateId },
      });

      if (!template) {
        throw new NotFoundException(
          `CampaignTemplate with ID ${updateDto.CampaignTemplateId} not found`,
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (updateDto.CampaignTemplateId !== undefined) {
      updateData.CampaignTemplateId = updateDto.CampaignTemplateId;
    }
    if (updateDto.campaignId !== undefined) {
      updateData.campaignId = updateDto.campaignId;
    }
    if (updateDto.lang !== undefined) {
      updateData.lang = updateDto.lang;
    }
    if (updateDto.type !== undefined) {
      updateData.type = updateDto.type;
    }
    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.content !== undefined) {
      updateData.content = updateDto.content;
    }
    if (updateDto.batch !== undefined) {
      updateData.batch = updateDto.batch;
    }

    return this.prisma.campaignSpintaxTemplate.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number): Promise<CampaignSpintaxTemplate> {
    // Check if spintax exists
    await this.findOne(id);

    return this.prisma.campaignSpintaxTemplate.delete({
      where: { id },
    });
  }
}

