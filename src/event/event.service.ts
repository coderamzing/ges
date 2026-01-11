import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './event.dto';
import { UpdateEventDto } from './event.dto';
import { Event } from '@prisma/client';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

  async create(createEventDto: CreateEventDto, promoterId: number): Promise<Event> {
    const data: any = {
      promoterId,
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

    return this.prisma.event.create({ data });
  }

  async findByPromoter(promoterId: number): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { promoterId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number, promoterId: number): Promise<Event> {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    if (event.promoterId !== promoterId) {
      throw new ForbiddenException('You do not have access to this event');
    }

    return event;
  }

  async update(id: number, updateEventDto: UpdateEventDto, promoterId: number): Promise<Event> {
    // Check if event exists and belongs to promoter
    const event = await this.findOne(id, promoterId);

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

    return this.prisma.event.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number, promoterId: number): Promise<Event> {
    // Check if event exists and belongs to promoter
    await this.findOne(id, promoterId);

    return this.prisma.event.delete({
      where: { id },
    });
  }
}

