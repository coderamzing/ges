import { Controller, Get, Post, Param, Body, ParseIntPipe, UseGuards, Headers, Query, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TempService } from './temp.service';
import { JwtAuthGuard, GetPromoter } from '../../guard';
import { CampaignInvitationService } from 'src/campaign-invitation/campaign-invitation.service';

@Controller('temp')
@UseGuards(JwtAuthGuard)
export class TempController {
    constructor(private readonly tempService: TempService,
        private readonly campaignInvitationService: CampaignInvitationService,
    ) { }

    @Get('campaigns/:id/messages')
    async getCampaignMessages(@Param('id', ParseIntPipe) id: number) {
        return this.tempService.getCampaignMessages(id);
    }

    @Get('talent/:talentId/thread')
    @ApiOperation({ summary: 'Get latest DM thread + messages for a talent (temp endpoint)' })
    @ApiResponse({
        status: 200,
        description: 'Thread, messages and prebuilt fullMessage for prompt testing',
    })
    async getTalentThread(
        @Param('talentId') talentId: string,
        @GetPromoter() promoter: { id: number; email: string },
        @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
        @Query('promoterUsername') promoterUsernameOverride?: string,
    ) {
        return this.tempService.getTalentThreadByTalentId(
            talentId,
            promoter.id,
            limit,
            promoterUsernameOverride,
        );
    }

    @Get('thread/:threadId')
    @ApiOperation({ summary: 'Get thread messages + prebuilt fullMessage by threadId (temp endpoint)' })
    @ApiResponse({
        status: 200,
        description: 'Thread, messages and prebuilt fullMessage for prompt testing',
    })
    async getThreadById(
        @Param('threadId') threadId: string,
        @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
    ) {
        return this.tempService.getThreadById(threadId, limit);
    }

    @Post('location/interpret')
    @ApiOperation({ summary: 'Interpret location from a full message thread (temp endpoint)' })
    @ApiResponse({
        status: 200,
        description: 'Returns only currentCity/futureCity/futureCityStartAt/futureCityEndAt/currentCityEndAt/cityHome',
    })
    async interpretLocation(@Body() body: { messages?: string; fullMessage?: string }) {
        return this.tempService.interpretLocationFromMessages(
            (body?.messages ?? body?.fullMessage ?? '').toString(),
        );
    }

    @Post('campaigns/:id/messages')
    async sendTalentMessage(
        @Param('id', ParseIntPipe) campaignId: number,
        @Body() body: { talentId: string; message: string },
        @GetPromoter() promoter: { id: number; email: string },
    ) {
        return this.tempService.sendTalentMessage(campaignId, body.talentId, body.message, promoter.id);
    }

    @Get('talent/:talentId/promoter/:promoterId/state')
    @ApiOperation({ summary: 'Get talent-promoter state (temp endpoint)' })
    async getTalentPromoterState(
        @Param('talentId') talentId: string,
        @Param('promoterId', ParseIntPipe) promoterId: number,
    ) {
        return this.tempService.getTalentPromoterState(talentId, promoterId);
    }

    @Get('talent/:talentId/promoter/:promoterId/logs')
    @ApiOperation({ summary: 'Get trust score logs for talent-promoter (temp endpoint)' })
    async getTrustScoreLogs(
        @Param('talentId') talentId: string,
        @Param('promoterId', ParseIntPipe) promoterId: number,
    ) {
        return this.tempService.getTrustScoreLogs(talentId, promoterId);
    }

    @ApiBearerAuth()
    @Post('send')
    @ApiOperation({ summary: 'Send chat message to a user' })
    @ApiHeader({
        name: 'x-auth-token',
        description: 'Authentication token',
        required: true,
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                receiverUsername: { type: 'string', example: 'tesla' },
                message: { type: 'string', example: 'hi !' },
            },
            required: ['receiverUsername', 'message'],
        },
    })
    @ApiResponse({
        status: 201,
        description: 'Message sent successfully',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid request body',
    })

    async sendMessage(
        @Headers('x-auth-token') token: string,
        @Body() body: { receiverUsername: string; message: string },
        @GetPromoter() promoter: { id: number; email: string },
    ) {
        return this.campaignInvitationService.sendMessage(
            // token,
            body.receiverUsername,
            body.message,
            promoter.id,
        );
    }



    @Get('blacklist')
    @ApiOperation({ summary: 'Get all blacklisted talents for the authenticated promoter' })
    @ApiResponse({ status: 200, description: 'List of blacklisted talents for the authenticated promoter' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async findAll(
        @GetPromoter() promoter: { id: number; email: string },
    ): Promise<any[]> {
        return this.tempService.getBlacklistedTalents(BigInt(promoter.id));
    }


}
