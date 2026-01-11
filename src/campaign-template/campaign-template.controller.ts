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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CampaignTemplateService } from './campaign-template.service';
import { CreateCampaignTemplateDto } from './campaign-template.dto';
import { UpdateCampaignTemplateDto } from './campaign-template.dto';
import { CampaignTemplate } from '@prisma/client';
import { JwtAuthGuard, GetPromoter } from '../../guard';

@ApiTags('campaign-templates')
@ApiBearerAuth()
@Controller('campaign-templates')
@UseGuards(JwtAuthGuard)
export class CampaignTemplateController {
  constructor(
    private readonly campaignTemplateService: CampaignTemplateService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign template' })
  @ApiResponse({
    status: 201,
    description: 'Campaign template created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found or does not belong to promoter',
  })
  async create(
    @Body() createCampaignTemplateDto: CreateCampaignTemplateDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignTemplate> {
    return this.campaignTemplateService.create(
      createCampaignTemplateDto,
      promoter.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all campaign templates' })
  @ApiQuery({
    name: 'campaignId',
    required: false,
    type: Number,
    description: 'Filter templates by campaign ID',
  })
  @ApiResponse({ status: 200, description: 'List of all campaign templates' })
  async findAll(
    @Query('campaignId') campaignId?: string,
  ): Promise<CampaignTemplate[]> {
    if (campaignId) {
      return this.campaignTemplateService.findByCampaign(
        parseInt(campaignId, 10),
      );
    }
    return this.campaignTemplateService.findAll();
  }

  @Get('promoter')
  @ApiOperation({
    summary: 'Get all campaign templates for the authenticated promoter',
  })
  @ApiResponse({
    status: 200,
    description: 'List of campaign templates for the promoter',
  })
  async findByPromoter(
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignTemplate[]> {
    return this.campaignTemplateService.findByPromoter(promoter.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign template by ID' })
  @ApiResponse({ status: 200, description: 'Campaign template found' })
  @ApiResponse({ status: 404, description: 'Campaign template not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignTemplate> {
    return this.campaignTemplateService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign template' })
  @ApiResponse({
    status: 200,
    description: 'Campaign template updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign template not found or does not belong to promoter',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCampaignTemplateDto: UpdateCampaignTemplateDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignTemplate> {
    return this.campaignTemplateService.update(
      id,
      updateCampaignTemplateDto,
      promoter.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign template' })
  @ApiResponse({
    status: 204,
    description: 'Campaign template deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign template not found or does not belong to promoter',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<void> {
    await this.campaignTemplateService.remove(id, promoter.id);
  }
}

