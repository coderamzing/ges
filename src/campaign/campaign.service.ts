import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignAutoLangModeDto, UpdateCampaignDto, UpdateCampaignPostEventTimeDto, UpdateCampaignStatusDto } from './campaign.dto';
import { Campaign, CampaignStatus, Prisma, TemplateType } from '@prisma/client';
import { DEFAULT_TEMPLATES } from '../campaign-template/campaign-template.config';
import { CAMPAIGN_TEMPLATE_SAVED_EVENT } from '../campaign-template/campaign-template.service';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name)
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) { }

  async create(createCampaignDto: CreateCampaignDto, promoterId: number): Promise<Campaign> {
    // Verify that the event exists and belongs to the promoter
    const event = await this.prisma.events.findUnique({
      where: { id: createCampaignDto.eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${createCampaignDto.eventId} not found`);
    }

    if (event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(`Event with ID ${createCampaignDto.eventId} does not belong to this promoter`);
    }

    // Create the campaign and default templates in a single transaction
    const campaign = await this.prisma.$transaction(async (tx) => {
      // Create the campaign with defaults
      const createdCampaign = await tx.campaign.create({
        data: {
          eventId: createCampaignDto.eventId,
          name: createCampaignDto.name ?? event.name ?? 'Untitled Campaign',
          status: createCampaignDto.status ?? CampaignStatus.draft,
          lang: createCampaignDto.lang ?? 'en',
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
    const events = await this.prisma.events.findMany({
      where: { userId: BigInt(promoterId) },
      select: { id: true },
    });

    const eventIds = events.map(event => Number(event.id));

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
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    if (event.userId?.toString() !== promoterId.toString()) {
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
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId?.toString() !== promoterId.toString()) {
      throw new NotFoundException(`Campaign does not belong to this promoter`);
    }

    if (updateCampaignStatusDto.status === 'active') {

      const invitationCount = await this.prisma.campaignInvitation.count({
        where: {
          campaignId: id,
          promoterId: BigInt(promoterId),
          batch: 1,
        },
      });

      if (invitationCount < 10) {
        throw new BadRequestException(
          `You must send at least 10 invitations in batch 1 before activating the campaign. Currently sent: ${invitationCount}`
        );
      }
      if (!campaign.start_at) {
        return this.prisma.campaign.update({
          where: { id },
          data: {
            status: 'active',
            start_at: new Date(),
          },
        });
      }
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: updateCampaignStatusDto.status
      },
    });
  }

  async updatePostEventTime(
    campaignId: number,
    dto: UpdateCampaignPostEventTimeDto,
    promoterId: number,
  ): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Verify ownership
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId !== BigInt(promoterId)) {
      throw new NotFoundException('Campaign does not belong to this promoter');
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        postEventTriggerAt: new Date(dto.postEventTriggerAt),
      },
    });
  }

  async remove(id: number, promoterId: number): Promise<Campaign> {


    const campaign = await this.findOne(id);


    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId !== BigInt(promoterId)) {
      throw new NotFoundException('Campaign does not belong to this promoter');
    }


    // await this.prisma.campaignMessage.deleteMany({
    //   where: {
    //     invitation: {
    //       campaignId: id,
    //     },
    //   },
    // });


    await this.prisma.campaignInvitation.deleteMany({
      where: { campaignId: id },
    });

    await this.prisma.campaignSpintaxTemplate.deleteMany({
      where: { campaignId: id },
    });

    await this.prisma.campaignTemplate.deleteMany({
      where: { campaignId: id },
    });


    return this.prisma.campaign.delete({
      where: { id },
    });
  }



  async updateAutoLangMode(
    campaignId: number,
    dto: UpdateCampaignAutoLangModeDto,
    promoterId: number,
  ): Promise<Campaign> {


    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event || event.userId !== BigInt(promoterId)) {
      throw new NotFoundException('Campaign does not belong to this promoter');
    }


    const updateData: any = {};
    if (dto.invitation_mode !== undefined) updateData.invitation_mode = dto.invitation_mode;
    if (dto.followup_mode !== undefined) updateData.followup_mode = dto.followup_mode;
    if (dto.thankyou_mode !== undefined) updateData.thankyou_mode = dto.thankyou_mode;

    return this.prisma.$transaction(async (prisma) => {

      const updatedCampaign = await prisma.campaign.update({
        where: { id: campaignId },
        data: updateData,
      });

      const updateTemplates = async (modeValue: boolean | undefined, type: TemplateType) => {
        if (modeValue === undefined) return;

        if (modeValue === true) {

          await prisma.campaignTemplate.updateMany({
            where: { campaignId, type },
            data: { isActive: true },
          });
        } else if (modeValue === false) {

          await prisma.campaignTemplate.updateMany({
            where: {
              campaignId,
              type,
              NOT: { lang: 'en' },
            },
            data: { isActive: false },
          });
        }
      };
      await updateTemplates(dto.invitation_mode, TemplateType.invitation);
      await updateTemplates(dto.followup_mode, TemplateType.followup);
      await updateTemplates(dto.thankyou_mode, TemplateType.postevent);

      return updatedCampaign;
    });
  }







}

