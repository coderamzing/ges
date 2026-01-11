import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TalentService } from './talent.service';
import { Talent } from '@prisma/client';

@ApiTags('talents')
@Controller('talents')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all talents' })
  @ApiResponse({ status: 200, description: 'List of all talents' })
  async findAll(): Promise<Talent[]> {
    return this.talentService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a talent by ID' })
  @ApiResponse({ status: 200, description: 'Talent found' })
  @ApiResponse({ status: 404, description: 'Talent not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Talent> {
    return this.talentService.findOne(id);
  }
}

