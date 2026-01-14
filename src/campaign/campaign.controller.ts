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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, UpdateCampaignDto, UpdateCampaignStatusDto, AddTalentsToCampaignDto, UpdateCampaignPostEventTimeDto } from './campaign.dto';
import { Campaign, CampaignInvitation } from '@prisma/client';
import { JwtAuthGuard, GetPromoter } from '../../guard';
import { CampaignInvitationService } from '../campaign-invitation/campaign-invitation.service';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly campaignInvitationService: CampaignInvitationService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 404, description: 'Event not found or does not belong to promoter' })
  async create(
    @Body() createCampaignDto: CreateCampaignDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Campaign> {
    return this.campaignService.create(createCampaignDto, promoter.id);
  }

  @Get('promoter')
  @ApiOperation({ summary: 'Get all campaigns for the authenticated promoter' })
  @ApiResponse({ status: 200, description: 'List of campaigns for the promoter' })
  async findByPromoter(
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Campaign[]> {
    return this.campaignService.findByPromoter(promoter.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  @ApiResponse({ status: 200, description: 'Campaign found' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Campaign> {
    return this.campaignService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update campaign status' })
  @ApiResponse({ status: 200, description: 'Campaign status updated successfully' })
  @ApiResponse({ status: 404, description: 'Campaign not found or does not belong to promoter' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCampaignStatusDto: UpdateCampaignStatusDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Campaign> {
    return this.campaignService.updateStatus(id, updateCampaignStatusDto, promoter.id);
  }


  @Patch(':id/post-event-time')
  @ApiOperation({ summary: 'Update post-event message trigger time' })
  @ApiResponse({ status: 200, description: 'Post-event trigger time updated successfully' })
  @ApiResponse({ status: 404, description: 'Campaign not found or does not belong to promoter' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async updatePostEventTime(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignPostEventTimeDto,
    @GetPromoter() promoter: { id: number },
  ): Promise<Campaign> {
    return this.campaignService.updatePostEventTime(id, dto, promoter.id);
  }




  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiResponse({ status: 200, description: 'Campaign updated successfully' })
  @ApiResponse({ status: 404, description: 'Campaign not found or does not belong to promoter' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCampaignDto: UpdateCampaignDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<Campaign> {
    return this.campaignService.update(id, updateCampaignDto, promoter.id);
  }


  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiResponse({ status: 204, description: 'Campaign deleted successfully' })
  @ApiResponse({ status: 404, description: 'Campaign not found or does not belong to promoter' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<void> {
    await this.campaignService.remove(id, promoter.id);
  }
}

