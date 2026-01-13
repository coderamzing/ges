import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CampaignStatsService } from './campaign-stats.service';
import { CampaignStatsDto } from './campaign-stats.dto';
import { JwtAuthGuard, GetPromoter } from '../../guard';

@ApiTags('campaign-stats')
@ApiBearerAuth()
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignStatsController {
  constructor(private readonly campaignStatsService: CampaignStatsService) {}

  @Get(':id/stats')
  @ApiOperation({ 
    summary: 'Get full campaign statistics (all batches)',
    description: 'Get overall campaign statistics aggregating batches 1 and 2.'
  })
  @ApiResponse({ status: 200, description: 'Campaign statistics retrieved successfully', type: CampaignStatsDto })
  @ApiResponse({ status: 404, description: 'Campaign not found or does not belong to promoter' })
  async getStats(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignStatsDto> {
    return this.campaignStatsService.getStats(id, promoter.id);
  }

  @Get(':id/batches/:batch/stats')
  @ApiOperation({
    summary: 'Get statistics for a specific batch in a campaign',
    description:
      'Get statistics for a single batch (1 or 2) including estimated delivery time, total time spent sending, and expected replies.',
  })
  @ApiResponse({ status: 200, description: 'Batch statistics retrieved successfully', type: CampaignStatsDto })
  @ApiResponse({ status: 404, description: 'Campaign not found or does not belong to promoter' })
  @ApiResponse({ status: 400, description: 'Invalid batch parameter (must be 1 or 2)' })
  async getBatchStats(
    @Param('id', ParseIntPipe) id: number,
    @Param('batch', ParseIntPipe) batch: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignStatsDto> {
    if (batch !== 1 && batch !== 2) {
      throw new BadRequestException('Batch must be 1 or 2');
    }

    return this.campaignStatsService.getStatsForBatch(id, promoter.id, batch);
  }
}

