import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto, UpdateCampaignStatusDto, AddTalentsToCampaignDto } from './campaign.dto';
import { Campaign, CampaignInvitation, InvitationStatus } from '@prisma/client';
import { DEFAULT_TEMPLATES } from '../campaign-template/campaign-template.config';
import { CAMPAIGN_TEMPLATE_SAVED_EVENT } from '../campaign-template/campaign-template.service';

@Injectable()
export class CampaignService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createCampaignDto: CreateCampaignDto, promoterId: number): Promise<Campaign> {
    // Verify that the event exists and belongs to the promoter
    const event = await this.prisma.event.findUnique({
      where: { id: createCampaignDto.eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${createCampaignDto.eventId} not found`);
    }

    if (event.promoterId !== promoterId) {
      throw new NotFoundException(`Event with ID ${createCampaignDto.eventId} does not belong to this promoter`);
    }

    // Create the campaign and default templates in a single transaction
    const campaign = await this.prisma.$transaction(async (tx) => {
      // Create the campaign
      const createdCampaign = await tx.campaign.create({
        data: {
          eventId: createCampaignDto.eventId,
          name: createCampaignDto.name,
          status: createCampaignDto.status,
          lang: createCampaignDto.lang,
        },
      });

      // Create default templates for all languages and types
      // Create them individually so we can get the created records and emit events
      const createdTemplates = await Promise.all(
        DEFAULT_TEMPLATES.map(template =>
          tx.campaignTemplate.create({
            data: {
              campaignId: createdCampaign.id,
              lang: template.lang,
              type: template.type,
              name: template.name,
              content: template.content,
              isActive: template.isActive,
            },
          }),
        ),
      );

      return { campaign: createdCampaign, templates: createdTemplates };
    });

    // Emit events for each created template after the transaction commits
    campaign.templates.forEach(template => {
      this.eventEmitter.emit(CAMPAIGN_TEMPLATE_SAVED_EVENT, template.id);
    });

    return campaign.campaign;
  }

  async findAll(): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return campaign;
  }

  async findByPromoter(promoterId: number): Promise<Campaign[]> {
    // Get all events for this promoter first
    const events = await this.prisma.event.findMany({
      where: { promoterId },
      select: { id: true },
    });

    const eventIds = events.map(event => event.id);

    if (eventIds.length === 0) {
      return [];
    }

    return this.prisma.campaign.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: number, updateCampaignDto: UpdateCampaignDto, promoterId: number): Promise<Campaign> {
    // Check if campaign exists
    const campaign = await this.findOne(id);

    // Verify that the event belongs to the promoter (if eventId is being updated or for existing campaign)
    let eventId = updateCampaignDto.eventId ?? campaign.eventId;
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    if (event.promoterId !== promoterId) {
      throw new NotFoundException(`Event with ID ${eventId} does not belong to this promoter`);
    }

    // Prepare update data
    const updateData: any = {};
    if (updateCampaignDto.eventId !== undefined) {
      updateData.eventId = updateCampaignDto.eventId;
    }
    if (updateCampaignDto.name !== undefined) {
      updateData.name = updateCampaignDto.name;
    }
    if (updateCampaignDto.status !== undefined) {
      updateData.status = updateCampaignDto.status;
    }
    if (updateCampaignDto.lang !== undefined) {
      updateData.lang = updateCampaignDto.lang;
    }

    return this.prisma.campaign.update({
      where: { id },
      data: updateData,
    });
  }

  async updateStatus(id: number, updateCampaignStatusDto: UpdateCampaignStatusDto, promoterId: number): Promise<Campaign> {
    // Check if campaign exists
    const campaign = await this.findOne(id);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.event.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.promoterId !== promoterId) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: updateCampaignStatusDto.status,
      },
    });
  }

  async remove(id: number, promoterId: number): Promise<Campaign> {
    // Check if campaign exists
    const campaign = await this.findOne(id);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.event.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.promoterId !== promoterId) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    return this.prisma.campaign.delete({
      where: { id },
    });
  }

  async getInvitations(campaignId: number, promoterId: number): Promise<CampaignInvitation[]> {
    // Check if campaign exists
    const campaign = await this.findOne(campaignId);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.event.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.promoterId !== promoterId) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    return this.prisma.campaignInvitation.findMany({
      where: { campaignId },
      orderBy: { id: 'asc' },
    });
  }

  async addTalentsToCampaign(
    campaignId: number,
    addTalentsDto: AddTalentsToCampaignDto,
    promoterId: number,
  ): Promise<CampaignInvitation[]> {
    // Check if campaign exists
    const campaign = await this.findOne(campaignId);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.event.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.promoterId !== promoterId) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    // Verify that all talents exist
    const talents = await this.prisma.talent.findMany({
      where: {
        id: { in: addTalentsDto.talentIds },
      },
    });

    if (talents.length !== addTalentsDto.talentIds.length) {
      const foundIds = talents.map(t => t.id);
      const missingIds = addTalentsDto.talentIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(`Talents with IDs ${missingIds.join(', ')} not found`);
    }

    // Check which invitations already exist (due to unique constraint on [campaignId, talentId])
    const existingInvitations = await this.prisma.campaignInvitation.findMany({
      where: {
        campaignId,
        talentId: { in: addTalentsDto.talentIds },
      },
      select: { talentId: true },
    });

    const existingTalentIds = existingInvitations.map(inv => inv.talentId);
    const newTalentIds = addTalentsDto.talentIds.filter(id => !existingTalentIds.includes(id));

    if (newTalentIds.length === 0) {
      return this.prisma.campaignInvitation.findMany({
        where: {
          campaignId,
          talentId: { in: addTalentsDto.talentIds },
        },
      });
    }

    // Create new invitations
    await this.prisma.campaignInvitation.createMany({
      data: newTalentIds.map(talentId => ({
        campaignId,
        eventId: campaign.eventId,
        promoterId,
        talentId,
        batch: 1,
        status: InvitationStatus.pending,
      })),
    });

    // Return all invitations (existing + newly created)
    return this.prisma.campaignInvitation.findMany({
      where: {
        campaignId,
        talentId: { in: addTalentsDto.talentIds },
      },
    });
  }

  async removeInvitation(campaignId: number, invitationId: number, promoterId: number): Promise<void> {
    // Check if campaign exists
    const campaign = await this.findOne(campaignId);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.event.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.promoterId !== promoterId) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    // Check if invitation exists and belongs to the campaign
    const invitation = await this.prisma.campaignInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${invitationId} not found`);
    }

    if (invitation.campaignId !== campaignId) {
      throw new NotFoundException(`Invitation does not belong to this campaign`);
    }

    await this.prisma.campaignInvitation.delete({
      where: { id: invitationId },
    });
  }
}

