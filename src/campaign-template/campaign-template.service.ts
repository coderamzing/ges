import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignTemplateDto } from './campaign-template.dto';
import { UpdateCampaignTemplateDto } from './campaign-template.dto';
import { CampaignTemplate, TemplateType } from '@prisma/client';
import { renderTemplate } from '../../utils/handlebar';


export const CAMPAIGN_TEMPLATE_SAVED_EVENT = 'campaign-template.saved';

@Injectable()
export class CampaignTemplateService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) { }

  async create(
    createCampaignTemplateDto: CreateCampaignTemplateDto,
    promoterId: number,
  ): Promise<CampaignTemplate> {
    // Verify that the campaign exists and belongs to a promoter's event
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: createCampaignTemplateDto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Campaign with ID ${createCampaignTemplateDto.campaignId} not found`,
      );
    }

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(
        `Campaign with ID ${createCampaignTemplateDto.campaignId} does not belong to this promoter`,
      );
    }

    const template = await this.prisma.campaignTemplate.create({
      data: {
        campaignId: createCampaignTemplateDto.campaignId,
        lang: createCampaignTemplateDto.lang,
        type: createCampaignTemplateDto.type,
        name: createCampaignTemplateDto.name,
        content: createCampaignTemplateDto.content,
        isActive: createCampaignTemplateDto.status === 'active',
      },
    });

    // Emit event for template save
    this.eventEmitter.emit(CAMPAIGN_TEMPLATE_SAVED_EVENT, template.id);

    return template;
  }

  async findAll(): Promise<CampaignTemplate[]> {
    return this.prisma.campaignTemplate.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<CampaignTemplate> {
    const template = await this.prisma.campaignTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`CampaignTemplate with ID ${id} not found`);
    }

    return template;
  }

  async findByCampaign(campaignId: number): Promise<CampaignTemplate[]> {
    return this.prisma.campaignTemplate.findMany({
      where: { campaignId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByCampaignAndType(
    campaignId: number,
    type: TemplateType,
  ): Promise<CampaignTemplate[]> {
    return this.prisma.campaignTemplate.findMany({
      where: {
        campaignId,
        type,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByPromoter(promoterId: number): Promise<CampaignTemplate[]> {
    // Get all events for this promoter first
    const events = await this.prisma.events.findMany({
      where: { userId: BigInt(promoterId) },
      select: { id: true },
    });

    const eventIds = events.map(event => Number(event.id));

    if (eventIds.length === 0) {
      return [];
    }

    // Get all campaigns for these events
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
      select: { id: true },
    });

    const campaignIds = campaigns.map(campaign => campaign.id);

    if (campaignIds.length === 0) {
      return [];
    }

    return this.prisma.campaignTemplate.findMany({
      where: {
        campaignId: {
          in: campaignIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(
    id: number,
    updateCampaignTemplateDto: UpdateCampaignTemplateDto,
    promoterId: number,
  ): Promise<CampaignTemplate> {
    // Check if template exists
    const template = await this.findOne(id);

    // Verify that the campaign belongs to the promoter (if campaignId is being updated or for existing template)
    let campaignId = updateCampaignTemplateDto.campaignId ?? template.campaignId;
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(
        `Campaign with ID ${campaignId} does not belong to this promoter`,
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (updateCampaignTemplateDto.campaignId !== undefined) {
      updateData.campaignId = updateCampaignTemplateDto.campaignId;
    }
    if (updateCampaignTemplateDto.lang !== undefined) {
      updateData.lang = updateCampaignTemplateDto.lang;
    }
    if (updateCampaignTemplateDto.type !== undefined) {
      updateData.type = updateCampaignTemplateDto.type;
    }
    if (updateCampaignTemplateDto.name !== undefined) {
      updateData.name = updateCampaignTemplateDto.name;
    }
    if (updateCampaignTemplateDto.content !== undefined) {
      updateData.content = updateCampaignTemplateDto.content;
    }
    if (updateCampaignTemplateDto.status !== undefined) {
      updateData.isActive = updateCampaignTemplateDto.status === 'active';
    }

    const updatedTemplate = await this.prisma.campaignTemplate.update({
      where: { id },
      data: updateData,
    });

    // Emit event for template save
    this.eventEmitter.emit(CAMPAIGN_TEMPLATE_SAVED_EVENT, updatedTemplate.id);

    return updatedTemplate;
  }

  // async remove(id: number, promoterId: number): Promise<CampaignTemplate> {

  //   console.log(id, promoterId, "incoming data a")
  //   // Check if template exists
  //   const template = await this.findOne(id);

  //   // Verify that the campaign belongs to the promoter
  //   const campaign = await this.prisma.campaign.findUnique({
  //     where: { id: template.campaignId },
  //   });

  //   if (!campaign) {
  //     throw new NotFoundException(
  //       `Campaign with ID ${template.campaignId} not found`,
  //     );
  //   }

  //   const event = await this.prisma.events.findUnique({
  //     where: { id: campaign.eventId },
  //   });

  //   if (!event || event.userId?.toString() !== promoterId.toString()) {
  //     throw new NotFoundException(
  //       `CampaignTemplate does not belong to this promoter`,
  //     );
  //   }

  //   return this.prisma.campaignTemplate.delete({
  //     where: { id },
  //   });
  // }

  async remove(id: number, promoterId: number): Promise<CampaignTemplate> {

    const template = await this.findOne(id);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: template.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Campaign with ID ${template.campaignId} not found`,
      );
    }

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId !== BigInt(promoterId)) {
      throw new NotFoundException(
        'CampaignTemplate does not belong to this promoter',
      );
    }

    await this.prisma.campaignSpintaxTemplate.deleteMany({
      where: { CampaignTemplateId: id },
    });

    return this.prisma.campaignTemplate.delete({
      where: { id },
    });
  }



  async previewTemplate(eventId: number, template: string): Promise<string> {
    // Fetch the event
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Prepare template variables with event details
    const variables = {
      name: 'Anna', // Default name as requested
      eventName: event.name || '',
      eventType: event.eventType || '',
      eventCity: event.city || '',
      eventDate: event.dt ? event.dt.toLocaleDateString() : '',
    };

    // Render the template with variables
    return renderTemplate(template, variables);
  }
}

