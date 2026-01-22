import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAiPromptDto } from './aiprompt.dto';
import { AiPrompt } from '@prisma/client';

@Injectable()
export class AiPromptService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<AiPrompt[]> {
    return this.prisma.aiPrompt.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<AiPrompt> {
    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException(`AiPrompt with ID ${id} not found`);
    }

    return prompt;
  }

  async getByKey(key: string): Promise<AiPrompt> {
    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { key },
    });

    if (!prompt) {
      throw new NotFoundException(`AiPrompt with key '${key}' not found`);
    }

    return prompt;
  }

  async update(id: number, updateAiPromptDto: UpdateAiPromptDto): Promise<AiPrompt> {
    // Check if prompt exists
    await this.findOne(id);

    const updateData: any = {};
    if (updateAiPromptDto.defs !== undefined) {
      updateData.defs = updateAiPromptDto.defs;
    }
    if (updateAiPromptDto.role !== undefined) {
      updateData.role = updateAiPromptDto.role;
    }

    return this.prisma.aiPrompt.update({
      where: { id },
      data: updateData,
    });
  }
}
