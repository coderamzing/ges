import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PromoterService } from './promoter.service';
import { CreatePromoterDto } from './promoter.dto';
import { UpdatePromoterDto } from './promoter.dto';
import { Promoter } from '@prisma/client';

@ApiTags('promoters')
@Controller('promoters')
export class PromoterController {
  constructor(private readonly promoterService: PromoterService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new promoter' })
  @ApiResponse({ status: 201, description: 'Promoter created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - promoter with this email already exists' })
  async create(@Body() createPromoterDto: CreatePromoterDto): Promise<Promoter> {
    return this.promoterService.create(createPromoterDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a promoter' })
  @ApiResponse({ status: 200, description: 'Promoter updated successfully' })
  @ApiResponse({ status: 404, description: 'Promoter not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - promoter with this email already exists' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePromoterDto: UpdatePromoterDto,
  ): Promise<Promoter> {
    return this.promoterService.update(id, updatePromoterDto);
  }
}

