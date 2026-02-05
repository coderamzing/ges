import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { CampaignTemplateService } from '../campaign-template/campaign-template.service';
import { TEMPLATE_VARIATION_PROMPT, DEFAULT_VARIATIONS_COUNT } from '../campaign-template/campaign-template.config';
import { CAMPAIGN_TEMPLATE_SAVED_EVENT } from '../campaign-template/campaign-template.service';
import { renderTemplate } from 'utils/handlebar';

@Injectable()
export class CampaignSpintaxTemplateListener {
    private readonly logger = new Logger(CampaignSpintaxTemplateListener.name);

    constructor(
        private prisma: PrismaService,
        private openAIService: OpenAIService,
        private campaignTemplateService: CampaignTemplateService,
    ) { }

    @OnEvent(CAMPAIGN_TEMPLATE_SAVED_EVENT)
    async handleCampaignTemplateSaved(templateId: number) {
        this.logger.log(
            `Campaign template saved event received for template ID: ${templateId}`,
        );

        try {

            // Load the full template
            const template = await this.campaignTemplateService.findOne(templateId);

            const langs = template.lang.split(',');

            if (!langs.length) {
                langs.push('en');
            }

            // Check if OpenAI service is available
            if (!this.openAIService.isServiceAvailable()) {
                this.logger.warn(
                    `OpenAI service is not available. Skipping variation generation for template ${template.id}`,
                );
                return;
            }

            const totalVariations = template.spintaxEnabled ? DEFAULT_VARIATIONS_COUNT : 1;

            // Build one prompt for all languages
            const prompt = renderTemplate(TEMPLATE_VARIATION_PROMPT, {
                templateContent: template.content,
                languages: langs.join(','),
                typeDescription: template.type,
                variationsCount: totalVariations,
            });

            const response = await this.openAIService.query(prompt);
            const items: any[] = response?.items;

            if (!Array.isArray(items) || items.length === 0) {
                throw new Error(`No valid items returned from OpenAI`);
            }

            const spintaxTemplates: any[] = [];
            items.forEach((item, index) => {
                spintaxTemplates.push({
                    CampaignTemplateId: template.id,
                    campaignId: template.campaignId,
                    lang: item.lang,
                    type: template.type,
                    name: `${template.name} (${item.lang})`,
                    content: item.content,
                    batch: template.batchId,
                });
            })

            if (!spintaxTemplates.length) {
                throw new Error(`No spintax templates to save after parsing OpenAI output`);
            }

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
                `Successfully generated and saved ${spintaxTemplates.length} spintax templates for template ${template.id}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to generate variations for template ${templateId}: ${error.message}`,
                error.stack,
            );
        }
    }
}

