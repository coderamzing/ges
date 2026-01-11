import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TalentScoreService } from './talent-score.service';
import { TalentScoreDto } from './talent-score.dto';
import { JwtAuthGuard, GetPromoter } from '../../guard';

@ApiTags('talent-score')
@ApiBearerAuth()
@Controller('talents')
@UseGuards(JwtAuthGuard)
export class TalentScoreController {
  constructor(private readonly talentScoreService: TalentScoreService) {}

  @Get(':id/score')
  @ApiOperation({ summary: 'Get trust score state and logs for a talent-promoter pair' })
  @ApiResponse({ status: 200, description: 'Talent score retrieved successfully', type: TalentScoreDto })
  @ApiResponse({ status: 404, description: 'Talent not found' })
  async getTalentScore(
    @Param('id', ParseIntPipe) talentId: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<TalentScoreDto> {
    return this.talentScoreService.getTalentScore(talentId, promoter.id);
  }
}

