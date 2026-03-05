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
import { Events } from '@prisma/client';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';
import { GetPromoter } from '../../guard/get-promoter.decorator';
// import { UpdateMainEventTypeDto } from 'src/campaign-stats/campaign-stats.dto';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createEventDto: CreateEventDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Events> {
    return this.eventService.create(createEventDto, promoter.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all events for the authenticated promoter' })
  @ApiResponse({ status: 200, description: 'List of events for the authenticated promoter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Events[]> {
    return this.eventService.findByPromoter(promoter.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get an event by ID' })
  @ApiResponse({ status: 200, description: 'Event found' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your event' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Events> {
    return this.eventService.findOne(id, promoter.id);
  }

  @UseGuards(JwtAuthGuard)
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
  ): Promise<Events> {
    return this.eventService.update(id, updateEventDto, promoter.id);
  }

  @UseGuards(JwtAuthGuard)
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

  // @Patch(':id/main-event-type')
  // @ApiOperation({ summary: 'Update main event type' })
  // @ApiResponse({ status: 200, description: 'Main event type updated successfully' })
  // @ApiResponse({ status: 404, description: 'Event not found' })
  // @ApiResponse({ status: 403, description: 'Forbidden - not your event' })
  // async updateMainEventType(
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() dto: UpdateMainEventTypeDto,
  //   @GetPromoter() promoter: { id: number },
  // ): Promise<Events> {
  //   return this.eventService.updateMainEventType(id, dto, promoter.id);
  // }


  @Get("event-details/:id")
  @ApiOperation({ summary: 'Get event details' })
  @ApiResponse({ status: 200, description: 'details of events' })
  async findEventDetails(
    @Param('id' ) id: string,
  ): Promise<any> {
    return this.eventService.findEventDetails(id);
  }


}

