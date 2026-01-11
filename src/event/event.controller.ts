import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventService } from './event.service';
import { CreateEventDto } from './event.dto';
import { UpdateEventDto } from './event.dto';
import { Event } from '@prisma/client';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';
import { GetPromoter } from '../../guard/get-promoter.decorator';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createEventDto: CreateEventDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Event> {
    return this.eventService.create(createEventDto, promoter.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all events for the authenticated promoter' })
  @ApiResponse({ status: 200, description: 'List of events for the authenticated promoter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Event[]> {
    return this.eventService.findByPromoter(promoter.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by ID' })
  @ApiResponse({ status: 200, description: 'Event found' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your event' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Event> {
    return this.eventService.findOne(id, promoter.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your event' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEventDto: UpdateEventDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Event> {
    return this.eventService.update(id, updateEventDto, promoter.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 204, description: 'Event deleted successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your event' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<void> {
    await this.eventService.remove(id, promoter.id);
  }
}

