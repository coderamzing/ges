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
import { TalentBlacklistService } from './talent-blacklist.service';
import { CreateTalentBlacklistDto } from './talent-blacklist.dto';
import { UpdateTalentBlacklistDto } from './talent-blacklist.dto';
import { TalentBlacklist } from '@prisma/client';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';
import { GetPromoter } from '../../guard/get-promoter.decorator';

@ApiTags('talent-blacklist')
@ApiBearerAuth()
@Controller('talent-blacklist')
@UseGuards(JwtAuthGuard)
export class TalentBlacklistController {
  constructor(private readonly talentBlacklistService: TalentBlacklistService) {}

  @Post()
  @ApiOperation({ summary: 'Add a talent to the blacklist' })
  @ApiResponse({ status: 201, description: 'Talent added to blacklist successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 404, description: 'Talent not found' })
  @ApiResponse({ status: 409, description: 'Talent is already blacklisted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createTalentBlacklistDto: CreateTalentBlacklistDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<TalentBlacklist> {
    return this.talentBlacklistService.create(createTalentBlacklistDto, promoter.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all blacklisted talents for the authenticated promoter' })
  @ApiResponse({ status: 200, description: 'List of blacklisted talents for the authenticated promoter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<TalentBlacklist[]> {
    return this.talentBlacklistService.findByPromoter(promoter.id);
  }

  @Get('check/:talentId')
  @ApiOperation({ summary: 'Check if a talent is blacklisted by the authenticated promoter' })
  @ApiResponse({ status: 200, description: 'Blacklist entry found (if exists)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkTalent(
    @Param('talentId') talentId: string,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<TalentBlacklist | null> {
    return this.talentBlacklistService.findByTalentAndPromoter(talentId, promoter.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blacklist entry by ID' })
  @ApiResponse({ status: 200, description: 'Blacklist entry found' })
  @ApiResponse({ status: 404, description: 'Blacklist entry not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your blacklist entry' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<TalentBlacklist> {
    return this.talentBlacklistService.findOne(id, promoter.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a blacklist entry' })
  @ApiResponse({ status: 200, description: 'Blacklist entry updated successfully' })
  @ApiResponse({ status: 404, description: 'Blacklist entry not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your blacklist entry' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTalentBlacklistDto: UpdateTalentBlacklistDto,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<TalentBlacklist> {
    return this.talentBlacklistService.update(id, updateTalentBlacklistDto, promoter.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a talent from blacklist by entry ID' })
  @ApiResponse({ status: 204, description: 'Talent removed from blacklist successfully' })
  @ApiResponse({ status: 404, description: 'Blacklist entry not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your blacklist entry' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<void> {
    await this.talentBlacklistService.remove(id, promoter.id);
  }

  @Delete('talent/:talentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a talent from blacklist by talent ID' })
  @ApiResponse({ status: 204, description: 'Talent removed from blacklist successfully' })
  @ApiResponse({ status: 404, description: 'Talent is not blacklisted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeByTalent(
    @Param('talentId') talentId: string,
    @GetPromoter() promoter: { id: number; email: string },
  ): Promise<void> {
    await this.talentBlacklistService.removeByTalentAndPromoter(talentId, promoter.id);
  }
}

