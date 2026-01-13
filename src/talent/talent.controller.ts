import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TalentService } from './talent.service';
import { TalentPool, TalentPromoterState } from '@prisma/client';
import { TalentRecommendationFiltersDto } from './talent.dto';

@ApiTags('talents')
@Controller('talents')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a talent by ID' })
  @ApiResponse({ status: 200, description: 'Talent found' })
  @ApiResponse({ status: 404, description: 'Talent not found' })
  async findOne(@Param('id') id: string): Promise<TalentPool> {
    return this.talentService.findOne(id);
  }
}

