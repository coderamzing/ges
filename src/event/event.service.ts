import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./event.dto";
import { UpdateEventDto } from "./event.dto";
import { Events } from "@prisma/client";
import { CampaignStatsService } from "src/campaign-stats/campaign-stats.service";
import { CampaignInvitationService } from "src/campaign-invitation/campaign-invitation.service";
import {
  InvitationStatus,
  type InvitationStatusType,
} from "src/campaign-invitation/campaign-invitation.config";
// import { UpdateMainEventTypeDto } from 'src/campaign-stats/campaign-stats.dto';

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private campaignStatsService: CampaignStatsService,
    private campaignInvitationService: CampaignInvitationService,
  ) {}

  async create(
    createEventDto: CreateEventDto,
    promoterId: number,
  ): Promise<Events> {
    const data: any = {
      userId: BigInt(promoterId),
      name: createEventDto.name,
      type: createEventDto.type,
      city: createEventDto.city,
      date: new Date(createEventDto.date),
      capacity: createEventDto.capacity,
      reach_time: new Date(createEventDto.reach_time),
    };

    if (createEventDto.start_time !== undefined) {
      data.start_time = new Date(createEventDto.start_time);
    }
    if (createEventDto.end_time !== undefined) {
      data.end_time = new Date(createEventDto.end_time);
    }

    return this.prisma.events.create({ data });
  }

  async findByPromoter(promoterId: number): Promise<Events[]> {
    return this.prisma.events.findMany({
      where: { userId: BigInt(promoterId) },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findOne(id: number, promoterId: number): Promise<Events> {
    const event = await this.prisma.events.findUnique({
      where: { id: BigInt(id) },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
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
    //   throw new ForbiddenException('You do not have access to this event');
    // }

    return event;
  }

  async update(
    id: number,
    updateEventDto: UpdateEventDto,
    promoterId: number,
  ): Promise<Events> {
    // Check if event exists and belongs to promoter
    await this.findOne(id, promoterId);

    // Prepare update data, converting date strings to Date objects
    const updateData: any = {};
    if (updateEventDto.name !== undefined) {
      updateData.name = updateEventDto.name;
    }
    if (updateEventDto.type !== undefined) {
      updateData.type = updateEventDto.type;
    }
    if (updateEventDto.city !== undefined) {
      updateData.city = updateEventDto.city;
    }
    if (updateEventDto.date !== undefined) {
      updateData.date = new Date(updateEventDto.date);
    }
    if (updateEventDto.capacity !== undefined) {
      updateData.capacity = updateEventDto.capacity;
    }
    if (updateEventDto.start_time !== undefined) {
      updateData.start_time = new Date(updateEventDto.start_time);
    }
    if (updateEventDto.end_time !== undefined) {
      updateData.end_time = new Date(updateEventDto.end_time);
    }
    if (updateEventDto.reach_time !== undefined) {
      updateData.reach_time = new Date(updateEventDto.reach_time);
    }

    return this.prisma.events.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
  }

  async remove(id: number, promoterId: number): Promise<Events> {
    // Check if event exists and belongs to promoter
    await this.findOne(id, promoterId);

    return this.prisma.events.delete({
      where: { id: BigInt(id) },
    });
  }

  //   async updateMainEventType(
  //   id: number,
  //   dto: UpdateMainEventTypeDto,
  //   promoterId: number,
  // ): Promise<Events> {
  //   // Ensure event exists & belongs to promoter
  //   await this.findOne(id, promoterId);

  //   return this.prisma.events.update({
  //     where: { id: BigInt(id) },
  //     data: {
  //       mainEventType: dto.mainEventType,
  //       updateAt: new Date(),
  //     },
  //   });
  // }

  async findEventDetails(id: string): Promise<any> {
    const eventShareData = await this.prisma.eventShare.findUnique({
      where: {
        id: id,
      },
    });

    if (!eventShareData) {
      throw new NotFoundException("Event share not found");
    }

    if (!eventShareData.event_id || !eventShareData.user_id) {
      throw new BadRequestException("Invalid event share data");
    }
    const eventId = Number(eventShareData.event_id);
    const promotorId = Number(eventShareData.user_id);

    const event = await this.prisma.events.findUnique({
      where: { id: BigInt(eventId) },
    });

    if (!event) {
      throw new NotFoundException(
        `Event not found with id ${eventId.toString()}`,
      );
    }

    const stats = await this.campaignStatsService.getStats(eventId, promotorId);

    const invitations =
      await this.campaignInvitationService.getInvitationsByCampaign(
        eventId,
        promotorId,
      );

    const statusGroups: {
      confirmed: InvitationStatusType[];
      pending: InvitationStatusType[];
      declined: InvitationStatusType[];
      noReply: InvitationStatusType[];
    } = {
      confirmed: [
        InvitationStatus.CONFIRMED,
        InvitationStatus.MANUALLY_CONFIRM,
      ],
      pending: [
        InvitationStatus.MANUALLY_PENDING,
        InvitationStatus.SENT,
        InvitationStatus.MAYBE,
      ],
      declined: [InvitationStatus.MANUALLY_DECLINED, InvitationStatus.DECLINED],
      noReply: [InvitationStatus.MANUALLY_NOREPLY, InvitationStatus.NOREPLY],
    };

    const confirmedList = invitations.filter(
      (inv) =>
        inv.status &&
        statusGroups.confirmed.includes(inv.status as InvitationStatusType),
    );

    const pendingList = invitations.filter(
      (inv) =>
        inv.status &&
        statusGroups.pending.includes(inv.status as InvitationStatusType),
    );

    const declinedList = invitations.filter(
      (inv) =>
        inv.status &&
        statusGroups.declined.includes(inv.status as InvitationStatusType),
    );

    const noReplyList = invitations.filter(
      (inv) =>
        inv.status &&
        statusGroups.noReply.includes(inv.status as InvitationStatusType),
    );

    return {
      ...event,
      confirmedList,
      pendingList,
      declinedList,
      noReplyList,
      stats,
    };
  }
}
