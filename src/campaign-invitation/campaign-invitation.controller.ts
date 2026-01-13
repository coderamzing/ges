import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignInvitationService } from './campaign-invitation.service';
import { GetInvitationsQueryDto, MarkInvitationsAsAttendedDto, MarkInvitationsForFollowupDto } from './campaign-invitation.dto';
import { CampaignInvitation, TalentPool, TalentPromoterState } from '@prisma/client';
import { JwtAuthGuard, GetPromoter } from '../../guard';
import { TalentService } from '../talent/talent.service';
import { TalentRecommendationFiltersDto } from '../talent/talent.dto';
import { AddTalentsToCampaignDto } from '../campaign/campaign.dto';

@ApiTags('campaign-invitations')
@ApiBearerAuth()
@Controller('campaign-invitations')
@UseGuards(JwtAuthGuard)
export class CampaignInvitationController {
  constructor(
    private readonly campaignInvitationService: CampaignInvitationService,
    private readonly talentService: TalentService,
  ) {}

  @Get('campaign/:campaignId')
  @ApiOperation({
    summary: 'Get invitations list for a campaign by ID',
    description: 'Returns invitations for a campaign. Can filter by status and/or hasReplied (for those who have not replied)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of campaign invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found or does not belong to promoter',
  })
  async getInvitationsByCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Query() query: GetInvitationsQueryDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignInvitation[]> {
    return this.campaignInvitationService.getInvitationsByCampaign(
      campaignId,
      promoter.id,
      query,
    );
  }

  @Patch('mark-attended')
  @ApiOperation({
    summary: 'Mark invitations as attended',
    description: 'Updates the status of specified invitations to "attended". The automation service will later send thank you messages to these invitations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations successfully marked as attended',
    schema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of invitations updated',
        },
        invitations: {
          type: 'array',
          items: { $ref: '#/components/schemas/CampaignInvitation' },
          description: 'Updated invitations',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found, does not belong to promoter, or some invitations not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  async markInvitationsAsAttended(
    @Body() markAttendedDto: MarkInvitationsAsAttendedDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<{ count: number; invitations: CampaignInvitation[] }> {
    return this.campaignInvitationService.markInvitationsAsAttended(
      markAttendedDto.campaignId,
      markAttendedDto.invitationIds,
      promoter.id,
    );
  }

  @Post('campaign/:campaignId')
  @ApiOperation({ summary: 'Add talents to campaign invitations' })
  @ApiResponse({
    status: 201,
    description: 'Talents added to campaign invitations successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or talents not found',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found or does not belong to promoter',
  })
  async addTalentsToCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() addTalentsDto: AddTalentsToCampaignDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignInvitation[]> {
    return this.campaignInvitationService.addTalentsToCampaign(
      campaignId,
      addTalentsDto,
      promoter.id,
    );
  }

  @Patch('mark-for-followup')
  @ApiOperation({
    summary: 'Mark invitations for followup',
    description: 'Sets followup = true for specified invitations. The automation service will later send followup messages to these invitations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations successfully marked for followup',
    schema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of invitations updated',
        },
        invitations: {
          type: 'array',
          items: { $ref: '#/components/schemas/CampaignInvitation' },
          description: 'Updated invitations',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found, does not belong to promoter, or some invitations not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  async markInvitationsForFollowup(
    @Body() markForFollowupDto: MarkInvitationsForFollowupDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<{ count: number; invitations: CampaignInvitation[] }> {
    return this.campaignInvitationService.markInvitationsForFollowup(
      markForFollowupDto.campaignId,
      markForFollowupDto.invitationIds,
      promoter.id,
    );
  }

  @Delete('campaign/:campaignId/:invitationId')
  @ApiOperation({ summary: 'Remove a talent from campaign invitations' })
  @ApiResponse({
    status: 204,
    description: 'Invitation removed successfully',
  })
  @ApiResponse({
    status: 404,
    description:
      'Campaign or invitation not found or does not belong to promoter',
  })
  async removeInvitation(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<void> {
    await this.campaignInvitationService.removeInvitation(
      campaignId,
      invitationId,
      promoter.id,
    );
  }

  @Get('campaign/:campaignId/batch/:batchId')
  @ApiOperation({
    summary: 'Get invitations for a campaign and batch',
    description:
      'Returns invitations for a specific campaign and batch. Can be filtered by status and/or hasReplied using query params.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of campaign invitations for the given batch',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found or does not belong to promoter',
  })
  async getInvitationsByCampaignAndBatch(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Query() query: GetInvitationsQueryDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<CampaignInvitation[]> {
    return this.campaignInvitationService.getInvitationsByCampaignAndBatch(
      campaignId,
      batchId,
      promoter.id,
      query,
    );
  }

  @Get('campaign/:campaignId/:batchId/recommendations')
  @ApiOperation({
    summary: 'Get talent recommendations for a campaign',
    description:
      'Returns talents from TalentPool excluding blacklisted and opted-out talents. Filters available: openchat, dmSent, firstChoice, backupGuests, blacklist, liked, hide, talentType, trustScore.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of recommended talents',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getTalentRecommendationsForCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Query() filters: TalentRecommendationFiltersDto,
  ): Promise<(TalentPool & { promoterState?: TalentPromoterState | null })[]> {
    return this.talentService.getRecommendations(campaignId, batchId, filters);
  }

  @Get('campaign/:campaignId/batch/:batchId/can-start')
  @ApiOperation({
    summary: 'Check if a batch can be started for a campaign',
    description:
      'A batch can only start when at least 90% of messages from the previous batch have been sent and there is a 12-hour gap since the last message of the previous batch was sent. Batch 1 can always start.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns true if the batch can be started, otherwise false',
    schema: { type: 'boolean' },
  })
  async canStartBatch2(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<boolean> {
    return this.campaignInvitationService.canStartBatch(
      campaignId,
      batchId,
      promoter.id,
    );
  }
}

