import { Controller, Get, Post, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { TempService } from './temp.service';
import { JwtAuthGuard, GetPromoter } from '../../guard';

@Controller('temp')
@UseGuards(JwtAuthGuard)
export class TempController {
  constructor(private readonly tempService: TempService) {}

  @Get('campaigns/:id/messages')
  async getCampaignMessages(@Param('id', ParseIntPipe) id: number) {
    return this.tempService.getCampaignMessages(id);
  }

  @Post('campaigns/:id/messages')
  async sendTalentMessage(
    @Param('id', ParseIntPipe) campaignId: number,
    @Body() body: { talentId: number; message: string },
    @GetPromoter() promoter: { id: number; email: string },
  ) {
    return this.tempService.sendTalentMessage(campaignId, body.talentId, body.message, promoter.id);
  }

  @Get('talent/:talentId/promoter/:promoterId/state')
  @ApiOperation({ summary: 'Get talent-promoter state (temp endpoint)' })
  async getTalentPromoterState(
    @Param('talentId', ParseIntPipe) talentId: number,
    @Param('promoterId', ParseIntPipe) promoterId: number,
  ) {
    return this.tempService.getTalentPromoterState(talentId, promoterId);
  }

  @Get('talent/:talentId/promoter/:promoterId/logs')
  @ApiOperation({ summary: 'Get trust score logs for talent-promoter (temp endpoint)' })
  async getTrustScoreLogs(
    @Param('talentId', ParseIntPipe) talentId: number,
    @Param('promoterId', ParseIntPipe) promoterId: number,
  ) {
    return this.tempService.getTrustScoreLogs(talentId, promoterId);
  }
}
