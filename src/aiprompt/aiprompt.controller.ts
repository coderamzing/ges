import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AiPromptService } from './aiprompt.service';
import { UpdateAiPromptDto } from './aiprompt.dto';
import { AiPrompt } from '@prisma/client';
import { JwtAuthGuard } from '../../guard/jwt-auth.guard';

@ApiTags('ai-prompts')
@ApiBearerAuth()
@Controller('ai-prompts')
@UseGuards(JwtAuthGuard)
export class AiPromptController {
  constructor(private readonly aiPromptService: AiPromptService) {}

  @Get()
  @ApiOperation({ summary: 'Get all AI prompts' })
  @ApiResponse({ status: 200, description: 'List of all AI prompts' })
  async findAll(): Promise<AiPrompt[]> {
    return this.aiPromptService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an AI prompt by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'AI Prompt ID' })
  @ApiResponse({ status: 200, description: 'AI Prompt found' })
  @ApiResponse({ status: 404, description: 'AI Prompt not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<AiPrompt> {
    return this.aiPromptService.findOne(id);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get an AI prompt by key' })
  @ApiParam({ name: 'key', type: String, description: 'AI Prompt key' })
  @ApiResponse({ status: 200, description: 'AI Prompt found' })
  @ApiResponse({ status: 404, description: 'AI Prompt not found' })
  async getByKey(@Param('key') key: string): Promise<AiPrompt> {
    return this.aiPromptService.getByKey(key);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an AI prompt' })
  @ApiParam({ name: 'id', type: Number, description: 'AI Prompt ID' })
  @ApiResponse({
    status: 200,
    description: 'AI Prompt updated successfully',
  })
  @ApiResponse({ status: 404, description: 'AI Prompt not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAiPromptDto: UpdateAiPromptDto,
  ): Promise<AiPrompt> {
    return this.aiPromptService.update(id, updateAiPromptDto);
  }
}
