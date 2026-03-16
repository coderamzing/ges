import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignTemplateDto, UpdateTemplateSpintaxDto } from './campaign-template.dto';
import { UpdateCampaignTemplateDto } from './campaign-template.dto';
import { CampaignTemplate, TemplateType } from '@prisma/client';
import { renderTemplate } from '../../utils/handlebar';


export const CAMPAIGN_TEMPLATE_SAVED_EVENT = 'campaign-template.saved';

@Injectable()
export class CampaignTemplateService {
    constructor(
        private prisma: PrismaService,
        private eventEmitter: EventEmitter2,
    ) { }

    async create(
        createCampaignTemplateDto: CreateCampaignTemplateDto,
        promoterId: number,
    ): Promise<CampaignTemplate> {
        // Verify that the campaign exists and belongs to a promoter's event
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: createCampaignTemplateDto.campaignId },
        });

        if (!campaign) {
            throw new NotFoundException(
                `Campaign with ID ${createCampaignTemplateDto.campaignId} not found`,
            );
        }

        const event = await this.prisma.events.findUnique({
            where: { id: campaign.eventId },
        });

         if (!event) {
      throw new NotFoundException(
        `Event with ID ${campaign.eventId} not found`,
      );
    }

    let collaborator = await this.prisma.eventCollaborator.findFirst({
      where: {
        event_id: event.id,
        user_id: promoterId,
      },
    });

    const isOwner = event.userId?.toString() === promoterId.toString();
    const isCollaborator = !!collaborator;

    if (!isOwner && !isCollaborator) {
      throw new NotFoundException(
        `Event with ID ${event.id} does not belong to this promoter`,
      );
    }

        // if (!event || event.userId?.toString() !== promoterId.toString()) {
        //     throw new NotFoundException(
        //         `Campaign with ID ${createCampaignTemplateDto.campaignId} does not belong to this promoter`,
        //     );
        // }

        const batchId = createCampaignTemplateDto.batchId ?? 1;

        const existing = await this.prisma.campaignTemplate.findFirst({
            where: ({
                campaignId: createCampaignTemplateDto.campaignId,
                type: createCampaignTemplateDto.type,
                batchId,
            } as any),
            orderBy: {
                createdAt: 'desc',
            },
        });

        const templateData = {
            batchId,
            lang: createCampaignTemplateDto.lang.join(','),
            type: createCampaignTemplateDto.type,
            name: createCampaignTemplateDto.name,
            content: createCampaignTemplateDto.content,
            mode: createCampaignTemplateDto.mode ?? 'auto',
            isActive: createCampaignTemplateDto.isActive,
            spintaxEnabled: createCampaignTemplateDto.spintaxEnabled ?? true,
        };

        const template = existing
            ? await this.prisma.campaignTemplate.update({
                where: { id: existing.id },
                data: templateData as any,
            })
            : await this.prisma.campaignTemplate.create({
                // NOTE: Prisma Client typings can get out of sync in-editor if client
                // generation isn't picked up immediately. Cast keeps runtime behavior correct.
                data: ({
                    ...templateData,
                    campaign: {
                        connect: { id: createCampaignTemplateDto.campaignId },
                    },
                } as any),
            });

        // ===== AUTO CREATE / UPDATE BATCH 2 FOR POSTEVENT =====

        let batch2Template: CampaignTemplate | null = null;

        if (
            createCampaignTemplateDto.type === 'postevent' &&
            batchId === 1
        ) {
            const batch2Existing = await this.prisma.campaignTemplate.findFirst({
                where: {
                    campaignId: createCampaignTemplateDto.campaignId,
                    type: createCampaignTemplateDto.type,
                    batchId: 2,
                } as any,
                orderBy: {
                    createdAt: 'desc',
                },
            });
            const batch2Data = {
                batchId: 2,
                lang: createCampaignTemplateDto.lang.join(','),
                type: createCampaignTemplateDto.type,
                name: createCampaignTemplateDto.name,
                content: createCampaignTemplateDto.content,
                mode: createCampaignTemplateDto.mode ?? 'auto',
                isActive: createCampaignTemplateDto.isActive,
                spintaxEnabled: createCampaignTemplateDto.spintaxEnabled ?? true,
            };

            if (batch2Existing) {
                batch2Template = await this.prisma.campaignTemplate.update({
                    where: { id: batch2Existing.id },
                    data: batch2Data as any,
                });

                console.log("batch2Template after update",batch2Template)
            } 
            else {
                batch2Template = await this.prisma.campaignTemplate.create({
                    data: {
                        ...batch2Data,
                        campaign: {
                            connect: {
                                id: createCampaignTemplateDto.campaignId,
                            },
                        },
                    } as any,
                });

            }
        }
                // Emit event for template save
            await this.eventEmitter.emitAsync(CAMPAIGN_TEMPLATE_SAVED_EVENT, template.id);

            if (batch2Template) {
            await this.eventEmitter.emitAsync(
                CAMPAIGN_TEMPLATE_SAVED_EVENT,
                batch2Template.id,
            );
        }

        return template;
    }

    async findAll(): Promise<CampaignTemplate[]> {
        return this.prisma.campaignTemplate.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(id: number): Promise<CampaignTemplate> {
        const template = await this.prisma.campaignTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            throw new NotFoundException(`CampaignTemplate with ID ${id} not found`);
        }

        return template;
    }

    async findByCampaign(campaignId: number): Promise<CampaignTemplate[]> {
        return this.prisma.campaignTemplate.findMany({
            where: { campaignId },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findByCampaignAndType(
        campaignId: number,
        type: TemplateType,
        batchId?: number,
    ): Promise<CampaignTemplate[]> {

        const where: any = { campaignId };

        if (type) where.type = type;
        if (batchId !== undefined) where.batchId = batchId;
        return this.prisma.campaignTemplate.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findByPromoter(promoterId: number): Promise<CampaignTemplate[]> {
        // Get all events for this promoter first
        const events = await this.prisma.events.findMany({
            where: { userId: BigInt(promoterId) },
            select: { id: true },
        });

        const eventIds = events.map(event => Number(event.id));

        if (eventIds.length === 0) {
            return [];
        }

        // Get all campaigns for these events
        const campaigns = await this.prisma.campaign.findMany({
            where: {
                eventId: {
                    in: eventIds,
                },
            },
            select: { id: true },
        });

        const campaignIds = campaigns.map(campaign => campaign.id);

        if (campaignIds.length === 0) {
            return [];
        }

        return this.prisma.campaignTemplate.findMany({
            where: {
                campaignId: {
                    in: campaignIds,
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async update(
        id: number,
        updateCampaignTemplateDto: UpdateCampaignTemplateDto,
        promoterId: number,
    ): Promise<CampaignTemplate> {
        // Check if template exists
        const template = await this.findOne(id);

        // Verify that the campaign belongs to the promoter (if campaignId is being updated or for existing template)
        let campaignId = updateCampaignTemplateDto.campaignId ?? template.campaignId;
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
        });

        if (!campaign) {
            throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
        }

        const event = await this.prisma.events.findUnique({
            where: { id: campaign.eventId },
        });
        if (!event) {
        throw new NotFoundException(
            `Event with ID ${campaign.eventId} not found`,
        );
        }

        let collaborator = await this.prisma.eventCollaborator.findFirst({
        where: {
            event_id: event.id,
            user_id: promoterId,
        },
        });

        const isOwner = event.userId?.toString() === promoterId.toString();
        const isCollaborator = !!collaborator;

        if (!isOwner && !isCollaborator) {
        throw new NotFoundException(
            `Event with ID ${event.id} does not belong to this promoter`,
        );
        }

        // if (!event || event.userId?.toString() !== promoterId.toString()) {
        //     throw new NotFoundException(
        //         `Campaign with ID ${campaignId} does not belong to this promoter`,
        //     );
        // }

        // Prepare update data
        const updateData: any = {};
        if (updateCampaignTemplateDto.campaignId !== undefined) {
            updateData.campaignId = updateCampaignTemplateDto.campaignId;
        }
        if (updateCampaignTemplateDto.batchId !== undefined) {
            updateData.batchId = updateCampaignTemplateDto.batchId;
        }
        if (updateCampaignTemplateDto.lang !== undefined) {
            updateData.lang = updateCampaignTemplateDto.lang.join(',');
        }
        if (updateCampaignTemplateDto.type !== undefined) {
            updateData.type = updateCampaignTemplateDto.type;
        }
        if (updateCampaignTemplateDto.name !== undefined) {
            updateData.name = updateCampaignTemplateDto.name;
        }
        if (updateCampaignTemplateDto.content !== undefined) {
            updateData.content = updateCampaignTemplateDto.content;
        }
        if (updateCampaignTemplateDto.mode !== undefined) {
            updateData.mode = updateCampaignTemplateDto.mode;
        }
        if (updateCampaignTemplateDto.isActive !== undefined) {
            updateData.isActive = updateCampaignTemplateDto.isActive;
        }
        if (updateCampaignTemplateDto.spintaxEnabled !== undefined) {
            updateData.spintaxEnabled = updateCampaignTemplateDto.spintaxEnabled;
        }

        // If we're deactivating this template, ensure at least one other ACTIVE template
        // remains for the same campaign + type.
        if (updateCampaignTemplateDto.isActive === false) {
            const typeToCheck = updateCampaignTemplateDto.type ?? template.type;
            const campaignToCheck = updateCampaignTemplateDto.campaignId ?? template.campaignId;

            const activeCount = await this.prisma.campaignTemplate.count({
                where: {
                    campaignId: campaignToCheck,
                    type: typeToCheck,
                    isActive: true,
                    NOT: { id },
                },
            });

            if (activeCount === 0) {
                throw new BadRequestException(
                    `At least one ACTIVE template is required for type '${typeToCheck}' in this campaign`
                );
            }
        }



        const updatedTemplate = await this.prisma.campaignTemplate.update({
            where: { id },
            data: updateData,
        });

        // Emit event for template save
        await this.eventEmitter.emitAsync(CAMPAIGN_TEMPLATE_SAVED_EVENT, updatedTemplate.id);

        return updatedTemplate;
    }

    // async remove(id: number, promoterId: number): Promise<CampaignTemplate> {

    //   console.log(id, promoterId, "incoming data a")
    //   // Check if template exists
    //   const template = await this.findOne(id);

    //   // Verify that the campaign belongs to the promoter
    //   const campaign = await this.prisma.campaign.findUnique({
    //     where: { id: template.campaignId },
    //   });

    //   if (!campaign) {
    //     throw new NotFoundException(
    //       `Campaign with ID ${template.campaignId} not found`,
    //     );
    //   }

    //   const event = await this.prisma.events.findUnique({
    //     where: { id: campaign.eventId },
    //   });

    //   if (!event || event.userId?.toString() !== promoterId.toString()) {
    //     throw new NotFoundException(
    //       `CampaignTemplate does not belong to this promoter`,
    //     );
    //   }

    //   return this.prisma.campaignTemplate.delete({
    //     where: { id },
    //   });
    // }

    async remove(id: number, promoterId: number): Promise<CampaignTemplate> {

        const template = await this.findOne(id);

        const campaign = await this.prisma.campaign.findUnique({
            where: { id: template.campaignId },
        });

        if (!campaign) {
            throw new NotFoundException(
                `Campaign with ID ${template.campaignId} not found`,
            );
        }

        const event = await this.prisma.events.findUnique({
            where: { id: campaign.eventId },
        });

         if (!event) {
            throw new NotFoundException(
                `Event with ID ${campaign.eventId} not found`,
            );
            }

            let collaborator = await this.prisma.eventCollaborator.findFirst({
            where: {
                event_id: event.id,
                user_id: promoterId,
            },
            });

            const isOwner = event.userId?.toString() === promoterId.toString();
            const isCollaborator = !!collaborator;

            if (!isOwner && !isCollaborator) {
            throw new NotFoundException(
                `Event with ID ${event.id} does not belong to this promoter`,
            );
            }

        // if (!event || event.userId !== BigInt(promoterId)) {
        //     throw new NotFoundException(
        //         'CampaignTemplate does not belong to this promoter',
        //     );
        // }

        await this.prisma.campaignSpintaxTemplate.deleteMany({
            where: { CampaignTemplateId: id },
        });

        return this.prisma.campaignTemplate.delete({
            where: { id },
        });
    }



    async previewTemplate(eventId: number, template: string): Promise<string> {
        // Fetch the event
        const event = await this.prisma.events.findUnique({
            where: { id: eventId },
        });

        if (!event) {
            throw new NotFoundException(`Event with ID ${eventId} not found`);
        }

        // Prepare template variables with event details
        const variables = {
            name: 'Anna', // Default name as requested
            eventName: event.name || '',
            eventType: event.eventType || '',
            eventCity: event.city || '',
            eventDate: event.dt ? event.dt.toLocaleDateString() : '',
        };

        // Render the template with variables
        return renderTemplate(template, variables);
    }

    async updateSpintaxEnabledByType(
        campaignId: number,
        type: TemplateType,
        spintaxEnabled: boolean,
        promoterId: number,
    ) {
        // 1️⃣ Validate campaign ownership
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
        });

        if (!campaign) {
            throw new NotFoundException(`Campaign not found`);
        }

        const event = await this.prisma.events.findUnique({
            where: { id: campaign.eventId },
        });

         if (!event) {
            throw new NotFoundException(
                `Event with ID ${campaign.eventId} not found`,
            );
            }

            let collaborator = await this.prisma.eventCollaborator.findFirst({
            where: {
                event_id: event.id,
                user_id: promoterId,
            },
            });

            const isOwner = event.userId?.toString() === promoterId.toString();
            const isCollaborator = !!collaborator;

            if (!isOwner && !isCollaborator) {
            throw new NotFoundException(
                `Event with ID ${event.id} does not belong to this promoter`,
            );
            }

        // if (!event || event.userId?.toString() !== promoterId.toString()) {
        //     throw new NotFoundException(`Campaign does not belong to this promoter`);
        // }

        // 2️⃣ Check templates exist (optional but good UX)
        const templates = await this.prisma.campaignTemplate.findMany({
            where: {
                campaignId,
                type,
            },
        });

        if (!templates.length) {
            throw new NotFoundException(
                `No templates found for type "${type}" in this campaign`,
            );
        }

        // 3️⃣ BULK UPDATE → all languages updated
        await this.prisma.campaignTemplate.updateMany({
            where: {
                campaignId,
                type,
            },
            data: {
                spintaxEnabled,
            },
        });

        // 4️⃣ Emit event once
        await this.eventEmitter.emitAsync(
            CAMPAIGN_TEMPLATE_SAVED_EVENT,
            campaignId,
        );

        return {
            message: 'Spintax setting updated successfully',
            campaignId,
            type,
            spintaxEnabled,
            updatedTemplates: templates.length,
        };
    }


}

