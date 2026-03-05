import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCampaignDto,
  UpdateCampaignAutoLangModeDto,
  UpdateCampaignDto,
  UpdateCampaignPostEventTimeDto,
  UpdateCampaignStatusDto,
  UpdateCampaignFollowupDelayDto,
} from "./campaign.dto";
import { Campaign, CampaignStatus, Prisma, TemplateType } from "@prisma/client";
import { DEFAULT_TEMPLATES } from "../campaign-template/campaign-template.config";
import { CAMPAIGN_TEMPLATE_SAVED_EVENT } from "../campaign-template/campaign-template.service";
import { InvitationStatus } from "src/campaign-invitation/campaign-invitation.config";

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  private readonly averageSendGapMs = 2 * 60 * 1000;

  async create(
    createCampaignDto: CreateCampaignDto,
    promoterId: number,
  ): Promise<Campaign> {
    // Verify that the event exists and belongs to the promoter
    const event = await this.prisma.events.findUnique({
      where: { id: createCampaignDto.eventId },
    });

    if (!event) {
      throw new NotFoundException(
        `Event with ID ${createCampaignDto.eventId} not found`,
      );
    }

    let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${createCampaignDto.eventId} does not belong to this promoter`,
      );
    }

    //  if (event.userId?.toString() !== promoterId.toString()) {
    //   throw new NotFoundException(
    //     `Event with ID ${event.id} does not belong to this promoter`,
    //   );
    // }

    const name = createCampaignDto.name?.trim()
      ? createCampaignDto.name.trim()
      : (event.name ?? "Untitled Campaign");

    const existingCampaign = await this.prisma.campaign.findFirst({
      where: { eventId: createCampaignDto.eventId },
    });

    if (existingCampaign) {
      const updatedCampaign = await this.prisma.campaign.update({
        where: { id: existingCampaign.id },
        data: {
          name,
          // status: createCampaignDto.status ?? existingCampaign.status,
          // lang: createCampaignDto.lang ?? existingCampaign.lang,
        },
      });

      return updatedCampaign;
    }

    // Create the campaign and default templates in a single transaction
    const campaign = await this.prisma.$transaction(async (tx) => {
      // Create the campaign with defaults
      const createdCampaign = await tx.campaign.create({
        data: {
          eventId: createCampaignDto.eventId,
          name: name,
          status: createCampaignDto.status ?? CampaignStatus.active,
          lang: createCampaignDto.lang ?? "en",
        },
      });

      // Create default templates for all languages and types
      // Create them individually so we can get the created records and emit events
      const createdTemplates = await Promise.all(
        DEFAULT_TEMPLATES.map((template) =>
          tx.campaignTemplate.create({
            data: {
              campaignId: createdCampaign.id,
              lang: template.lang,
              type: template.type,
              name: template.name,
              content: template.content,
              isActive: template.isActive,
              batchId: template.batchId,
            },
          }),
        ),
      );
      return { campaign: createdCampaign, templates: createdTemplates };
    });

    // // Emit events for each created template after the transaction commits
    // campaign.templates.forEach(template => {
    //     this.eventEmitter.emit(CAMPAIGN_TEMPLATE_SAVED_EVENT, template.id);
    // });

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

  async findByPromoter(promoterId: number) {
    const events = await this.prisma.events.findMany({
      where: { userId: BigInt(promoterId) },
      select: { id: true, dt: true },
    });

    const eventIds = events.map((e) => Number(e.id));

    if (!eventIds.length) {
      return [];
    }
    const eventMap = new Map(events.map((e) => [Number(e.id), e.dt]));

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const campaignIds = campaigns.map((c) => c.id);

    if (!campaignIds.length) {
      return campaigns;
    }

    const invitations = await this.prisma.campaignInvitation.findMany({
      where: {
        campaignId: {
          in: campaignIds,
        },
        NOT: {
          status: {
            startsWith: "manually",
          },
        },
      },
    });
    const now = new Date();

    const campaignsWithSummary = campaigns.map((campaign) => {
      const campaignInvites = invitations.filter(
        (inv) => inv.campaignId === campaign.id,
      );
      const pendingInvites = campaignInvites.filter(
        (i) => i.status === InvitationStatus.INIT,
      ).length;

      const sentInvites = campaignInvites.filter(
        (i) => i.status !== InvitationStatus.INIT && i.invitationAt,
      );

      const lastSentAt =
        sentInvites.length > 0
          ? sentInvites.reduce((latest, inv) =>
              new Date(inv.invitationAt!) > new Date(latest.invitationAt!)
                ? inv
                : latest,
            ).invitationAt
          : null;

      let estimatedCompletionAt: Date | null = null;
      let estimatedRemainingSeconds = 0;

      if (pendingInvites > 0) {
        estimatedRemainingSeconds = Math.floor(
          (pendingInvites * this.averageSendGapMs) / 1000,
        );

        const baseTime = lastSentAt ? new Date(lastSentAt) : new Date();

        estimatedCompletionAt = new Date(
          baseTime.getTime() + pendingInvites * this.averageSendGapMs,
        );
      }
      return {
        ...campaign,
        eventDate: eventMap.get(Number(campaign.eventId)) || null,
        summary: {
          total: campaignInvites.length,
          pendingInvites,
          sentInvites: sentInvites.length,
          estimatedRemainingSeconds,
          estimatedCompletionAt,
        },
      };
    });

    return campaignsWithSummary;
  }

  async update(
    id: number,
    updateCampaignDto: UpdateCampaignDto,
    promoterId: number,
  ): Promise<Campaign> {
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

      let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${event.id} does not belong to this promoter`,
      );
    }

    // if (event.userId?.toString() !== promoterId.toString()) {
    //   throw new NotFoundException(
    //     `Event with ID ${eventId} does not belong to this promoter`,
    //   );
    // }

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

  async updateStatus(
    id: number,
    updateCampaignStatusDto: UpdateCampaignStatusDto,
    promoterId: number,
  ): Promise<Campaign> {
    // Check if campaign exists
    const campaign = await this.findOne(id);

    // Verify that the event belongs to the promoter
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event) {
      throw new NotFoundException(
        `Event with ID ${campaign.eventId} not found`,
      );
    }

    let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${event.id} does not belong to this promoter`,
      );
    }

    // if (!event || event.userId?.toString() !== promoterId.toString()) {
    //   throw new NotFoundException(`Campaign does not belong to this promoter`);
    // }

    if (updateCampaignStatusDto.status === "active") {
      if (!campaign.start_at) {
        return this.prisma.campaign.update({
          where: { id },
          data: {
            status: CampaignStatus.active,
            start_at: new Date(),
          },
        });
      }
      // const invitationCount = await this.prisma.campaignInvitation.count({
      //     where: {
      //         campaignId: id,
      //         promoterId: BigInt(promoterId),
      //         batch: 1,
      //     },
      // });
      // let guests = event.guests ?? 10;

      // if (invitationCount < guests) {
      //     throw new BadRequestException(
      //         `You must send at least ${guests} invitations in batch 1 before activating the campaign. Currently sent: ${invitationCount}`
      //     );
      // }
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: updateCampaignStatusDto.status,
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
      throw new NotFoundException("Campaign not found");
    }

    // Verify ownership
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

     if (!event) {
      throw new NotFoundException(
        `Event with ID ${campaign.eventId} not found`,
      );
    }

    let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${event.id} does not belong to this promoter`,
      );
    }

    // if (!event || event.userId !== BigInt(promoterId)) {
    //   throw new NotFoundException("Campaign does not belong to this promoter");
    // }

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

    if (!event) {
      throw new NotFoundException(
        `Event with ID ${campaign.eventId} not found`,
      );
    }

    let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${event.id} does not belong to this promoter`,
      );
    }

    // if (!event || event.userId !== BigInt(promoterId)) {
    //   throw new NotFoundException("Campaign does not belong to this promoter");
    // }

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

  async updateFollowupDelay(
    campaignId: number,
    dto: UpdateCampaignFollowupDelayDto,
    promoterId: number,
  ): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    // Verify ownership
    const event = await this.prisma.events.findUnique({
      where: { id: campaign.eventId },
    });

    if (!event) {
      throw new NotFoundException(
        `Event with ID ${campaign.eventId} not found`,
      );
    }

    let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${event.id} does not belong to this promoter`,
      );
    }
    // if (!event || event.userId !== BigInt(promoterId)) {
    //   throw new NotFoundException("Campaign does not belong to this promoter");
    // }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        followup_delay: dto.followup_delay,
      },
    });
  }
}
