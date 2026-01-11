import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { CampaignTemplateService } from './campaign-template.service';
import { TEMPLATE_VARIATION_PROMPT, DEFAULT_VARIATIONS_COUNT } from './campaign-template.config';
import { CAMPAIGN_TEMPLATE_SAVED_EVENT } from './campaign-template.service';
import { renderTemplate } from 'utils/handlebar';

@Injectable()
export class CampaignTemplateListener {
  private readonly logger = new Logger(CampaignTemplateListener.name);

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
    private campaignTemplateService: CampaignTemplateService,
  ) {}

  @OnEvent(CAMPAIGN_TEMPLATE_SAVED_EVENT)
  async handleCampaignTemplateSaved(templateId: number) {
    this.logger.log(
      `Campaign template saved event received for template ID: ${templateId}`,
    );

    try {

       // Load the full template
      const template = await this.campaignTemplateService.findOne(templateId);

      // Only generate variations if the template is active
      if (!template.isActive) {
        this.logger.log(
          `Template ${template.id} is not active, skipping variation generation`,
        );
        return;
      }
      
      // Check if OpenAI service is available
      if (!this.openAIService.isServiceAvailable()) {
        this.logger.warn(
          `OpenAI service is not available. Skipping variation generation for template ${template.id}`,
        );
        return;
      }

      this.logger.log(
        `Generating 12 variations for active template ${template.id} (${template.lang})`,
      );

      // Build the prompt for OpenAI
      const prompt = renderTemplate(TEMPLATE_VARIATION_PROMPT,{
        templateContent: template.content,
        language: template.lang,
        typeDescription: template.type,
        variationsCount: DEFAULT_VARIATIONS_COUNT,
      });

      // Call OpenAI to generate variations (returns JSON object with variations array)
      const response = await this.openAIService.query(prompt);

      const variations = response.variations;

      if (variations.length === 0) {
        throw new Error('No valid variations returned from OpenAI');
      }

      // Save the variations to CampaignSpintaxTemplate
      const spintaxTemplates = variations.map((variation: string, index: number) => ({
        CampaignTemplateId: template.id,
        campaignId: template.campaignId,
        lang: template.lang,
        type: template.type,
        name: `${template.name} Variation ${index + 1}`,
        content: variation.trim(),
      }));

      // Delete existing spintax templates and create new ones in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Delete existing spintax templates for this template (if any)
        await tx.campaignSpintaxTemplate.deleteMany({
          where: {
            CampaignTemplateId: template.id,
          },
        });
        await tx.campaignSpintaxTemplate.createMany({
          data: spintaxTemplates,
        });
      });

      this.logger.log(
        `Successfully generated and saved ${variations.length} variations for template ${template.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate variations for template ${templateId}: ${error.message}`,
        error.stack,
      );
    }
  }
}

