import {
  Controller,
  Get,
  Put,
  Body,
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
import { CampaignSpintaxTemplateService } from './campaign-spintax-template.service';
import { UpdateCampaignSpintaxTemplateDto } from './campaign-spintax-template.dto';
import { CampaignSpintaxTemplate, TemplateType } from '@prisma/client';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';

@ApiTags('campaign-spintax-templates')
@ApiBearerAuth()
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignSpintaxTemplateController {
  constructor(
    private readonly campaignSpintaxTemplateService: CampaignSpintaxTemplateService,
  ) {}

  @Get('spintax/:id')
  @ApiOperation({ summary: 'Get a spintax template by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Spintax template found' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Spintax template not found' 
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignSpintaxTemplate> {
    return this.campaignSpintaxTemplateService.findOne(id);
  }

  @Get(':campaignId/spintax')
  @ApiOperation({ 
    summary: 'Get spintax templates for a campaign',
    description: 'Fetch all spintax templates for a campaign. Optionally filter by type, lang, and batch query parameters.'
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TemplateType,
    description: 'Filter by template type (invitation, followup, postevent)',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    type: String,
    description: 'Filter by language code (e.g., en, fr)',
  })
  @ApiQuery({
    name: 'batch',
    required: false,
    type: Number,
    description: 'Filter by batch number (1 or 2)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of spintax templates for the campaign' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Campaign not found' 
  })
  async findByCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Query('type') type?: TemplateType,
    @Query('lang') lang?: string,
    @Query('batch') batch?: string,
  ): Promise<CampaignSpintaxTemplate[]> {
    const batchNumber = batch ? parseInt(batch, 10) : undefined;
    return this.campaignSpintaxTemplateService.findByCampaign(
      campaignId,
      type,
      lang,
      batchNumber,
    );
  }

  @Put('spintax/:id')
  @ApiOperation({ summary: 'Update a spintax template' })
  @ApiResponse({
    status: 200,
    description: 'Spintax template updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Spintax template not found',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - validation failed' 
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCampaignSpintaxTemplateDto,
  ): Promise<CampaignSpintaxTemplate> {
    return this.campaignSpintaxTemplateService.update(id, updateDto);
  }

  @Delete('spintax/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a spintax template' })
  @ApiResponse({
    status: 204,
    description: 'Spintax template deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Spintax template not found',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.campaignSpintaxTemplateService.remove(id);
  }
}

