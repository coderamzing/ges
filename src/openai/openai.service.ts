import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: any;
  private isAvailable = false;

  constructor(private configService: ConfigService) {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    try {
      const openaiModule = require('openai');
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');

      if (!apiKey) {
        this.logger.warn('OpenAI API key not found. OpenAI service will be disabled.');
        return;
      }

      this.openai = new openaiModule({ apiKey });
      this.isAvailable = true;
      this.logger.log('OpenAI service initialized successfully');
    } catch (error: any) {
      this.logger.warn(`Failed to initialize OpenAI service: ${error.message}`);
      this.isAvailable = false;
    }
  }

  async query(prompt: string): Promise<any> {
    if (!this.isAvailable || !this.openai) {
      throw new Error('OpenAI service is not available. Please set OPENAI_API_KEY.');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    return JSON.parse(content);
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }
}