import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get campaign statistics' })
  @ApiResponse({ status: 200, description: 'Campaign statistics retrieved successfully', type: CampaignStatsDto })
  @ApiResponse({ status: 404, description: 'Campaign not found or does not belong to promoter' })
  async getStats(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignStatsDto> {
    return this.campaignStatsService.getStats(id, promoter.id);
  }
}

