import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignMessagesService } from '../campaign-messages/campaign-messages.service';
import { InvitationStatus, MessageDirection, TemplateType, Prisma, CampaignStatus } from '@prisma/client';
import { renderTemplate } from 'utils/handlebar';

@Injectable()
export class CampaignInvitationAutomationService {
  private readonly logger = new Logger(CampaignInvitationAutomationService.name);

  constructor(
    private prisma: PrismaService,
    private campaignMessagesService: CampaignMessagesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendInitialMessages() {
    this.logger.log('Process sending initial messages');

    try {
      // Find all pending invitations that haven't been sent yet (invitationAt is null)
      const pendingInvitations = await this.prisma.campaignInvitation.findMany({
        where: {
          AND: [
            { status: InvitationStatus.pending },
            {
              campaign: {
                status: CampaignStatus.active
              },
            },
          ],
        },
        include: {
          campaign: true,
        },
      });

      this.logger.log(`Found ${pendingInvitations.length} pending invitations to process`);

      for (const invitation of pendingInvitations) {
        try {
          await this.sendInitialMessage(invitation);
        } catch (error) {
          this.logger.error(
            `Failed to send initial message for invitation ${invitation.id}:`,
            error,
          );
        }
      }

      this.logger.log('Completed automation to send initial messages');
    } catch (error) {
      this.logger.error('Error in sendInitialMessages automation:', error);
    }
    this.logger.log('END Process sending initial messages');
  }

  async sendInitialMessage(
    invitation: Prisma.CampaignInvitationGetPayload<{
      include: { campaign: true };
    }>,
  ): Promise<void> {
    const campaign = invitation.campaign;

    // Get related data
    const [talent, event] = await Promise.all([
        this.prisma.talent.findUnique({
          where: { id: invitation.talentId },
        }),
        this.prisma.event.findUnique({
          where: { id: invitation.eventId },
        }),
    ]);

    if (!campaign) {
      throw new Error(`Campaign with ID ${invitation.campaignId} not found`);
    }

    if (!talent) {
      throw new Error(`Talent with ID ${invitation.talentId} not found`);
    }

    if (!event) {
      throw new Error(`Event with ID ${invitation.eventId} not found`);
    }

    // Get talent's preferred language or default to 'en'
    let talentLang = talent.langPreferred || 'en';
    
    // Find spintax templates matching the talent's language or fallback to 'en'
    let spintaxTemplates = await this.prisma.campaignSpintaxTemplate.findMany({
      where: {
        campaignId: campaign.id,
        type: TemplateType.invitation,
        lang: {
          in: ['en', talent.langPreferred || 'en'],
        },
      },
    });
    
    let preferredTemplates = spintaxTemplates.filter(template => template.lang === talentLang);

    if (!preferredTemplates.length) {
      preferredTemplates = spintaxTemplates.filter(template => template.lang === 'en');
    }

    if(!preferredTemplates.length) {
      this.logger.warn(
        `No spintax templates found for campaign ${campaign.id} with language ${talentLang} or 'en'`,
      );
      return;
    }

    // Select a random spintax template
    const randomTemplate =
      preferredTemplates[Math.floor(Math.random() * preferredTemplates.length)];

    this.logger.log(
      `Selected template ${randomTemplate.id} for invitation ${invitation.id}`,
    );

    // Prepare template variables
    const variables = {
      name: talent.name,
      eventName: event.name,
      eventType: event.type,
      eventCity: event.city,
      eventDate: event.date.toLocaleDateString(),
      eventStartTime: event.start_time
        ? event.start_time.toLocaleTimeString()
        : '',
      eventEndTime: event.end_time ? event.end_time.toLocaleTimeString() : '',
    };
    
    // Render the template with variables using handlebar
    const message = renderTemplate(randomTemplate.content, variables);

    // Create the message entry
    await this.campaignMessagesService.createMessage({
      campaignId: campaign.id,
      promoterId: invitation.promoterId,
      invitationId: invitation.id,
      talentId: talent.id,
      direction: MessageDirection.sent,
      message: message,
      sentAt: new Date(),
    });

    // Update the invitation to mark it as sent
    await this.prisma.campaignInvitation.update({
      where: { id: invitation.id },
      data: {
        invitationAt: new Date(),
      },
    });

    this.logger.log(
      `Successfully sent initial message for invitation ${invitation.id}`,
    );
  }

  /**
   * Send followup messages to invitations with status "maybe" or who haven't replied
   * Runs every hour via cron
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendFollowupMessages() {
    this.logger.log('Process sending followup messages');

    try {
      // Find invitations that need followup:
      // - status is "maybe" OR hasReplied is false
      // - followupSent is false
      // - invitationAt is not null (initial message has been sent)
      const invitationsNeedingFollowup = await this.prisma.campaignInvitation.findMany({
        where: {
          AND: [
            {
              OR: [
                { status: InvitationStatus.maybe },
                { hasReplied: false },
              ],
            },
            { followupSent: false },
            { invitationAt: { not: null } },
            {
              campaign: {
                status: CampaignStatus.active
              },
            }
          ],
        },
        include: {
          campaign: true,
        },
      });

      this.logger.log(`Found ${invitationsNeedingFollowup.length} invitations needing followup`);

      for (const invitation of invitationsNeedingFollowup) {
        try {
          await this.sendFollowupMessage(invitation);
        } catch (error) {
          this.logger.error(
            `Failed to send followup message for invitation ${invitation.id}:`,
            error,
          );
        }
      }

      this.logger.log('Completed automation to send followup messages');
    } catch (error) {
      this.logger.error('Error in sendFollowupMessages automation:', error);
    }
    this.logger.log('END Process sending followup messages');
  }

  async sendFollowupMessage(
    invitation: Prisma.CampaignInvitationGetPayload<{
      include: { campaign: true };
    }>,
  ): Promise<void> {
    const campaign = invitation.campaign;

    // Get related data
    const [talent, event] = await Promise.all([
      this.prisma.talent.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.event.findUnique({
        where: { id: invitation.eventId },
      }),
    ]);

    if (!campaign) {
      throw new Error(`Campaign with ID ${invitation.campaignId} not found`);
    }

    if (!talent) {
      throw new Error(`Talent with ID ${invitation.talentId} not found`);
    }

    if (!event) {
      throw new Error(`Event with ID ${invitation.eventId} not found`);
    }

    // Get talent's preferred language or default to 'en'
    let talentLang = talent.langPreferred || 'en';
    
    // Find spintax templates for followup matching the talent's language or fallback to 'en'
    let spintaxTemplates = await this.prisma.campaignSpintaxTemplate.findMany({
      where: {
        campaignId: campaign.id,
        type: TemplateType.followup,
        lang: {
          in: ['en', talent.langPreferred || 'en'],
        },
      },
    });
    
    let preferredTemplates = spintaxTemplates.filter(template => template.lang === talentLang);

    if (!preferredTemplates.length) {
      preferredTemplates = spintaxTemplates.filter(template => template.lang === 'en');
    }

    if(!preferredTemplates.length) {
      this.logger.warn(
        `No followup spintax templates found for campaign ${campaign.id} with language ${talentLang} or 'en'`,
      );
      return;
    }

    // Select a random spintax template
    const randomTemplate =
      preferredTemplates[Math.floor(Math.random() * preferredTemplates.length)];

    this.logger.log(
      `Selected followup template ${randomTemplate.id} for invitation ${invitation.id}`,
    );

    // Prepare template variables
    const variables = {
      name: talent.name,
      eventName: event.name,
      eventType: event.type,
      eventCity: event.city,
      eventDate: event.date.toLocaleDateString(),
      eventStartTime: event.start_time
        ? event.start_time.toLocaleTimeString()
        : '',
      eventEndTime: event.end_time ? event.end_time.toLocaleTimeString() : '',
    };
    // Render the template with variables using handlebar
    const message = renderTemplate(randomTemplate.content, variables);

    // Create the message entry
    await this.campaignMessagesService.createMessage({
      campaignId: campaign.id,
      promoterId: invitation.promoterId,
      invitationId: invitation.id,
      talentId: talent.id,
      direction: MessageDirection.sent,
      message: message,
      sentAt: new Date(),
    });

    // Update the invitation to mark followup as sent
    await this.prisma.campaignInvitation.update({
      where: { id: invitation.id },
      data: {
        followupSent: true,
      },
    });

    this.logger.log(
      `Successfully sent followup message for invitation ${invitation.id}`,
    );
  }

  /**
   * Send thank you messages after postEventTriggerAt has passed
   * Runs every minute via cron
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendThankYouMessages() {
    this.logger.log('Process sending thank you messages');

    try {
      const now = new Date();

      // Find invitations that need thank you messages:
      // - Campaign's postEventTriggerAt has passed
      // - thankYouSent is false
      // - status is "attended"
      const invitationsNeedingThankYou = await this.prisma.campaignInvitation.findMany({
        where: {
          AND: [
            { thankYouSent: false },
            { status: InvitationStatus.attended },
            {
              campaign: {
                status: CampaignStatus.completed,
                postEventTriggerAt: {
                  not: null,
                  lte: now, // less than or equal to now (has passed)
                },
              },
            },
          ],
        },
        include: {
          campaign: true,
        },
      });

      this.logger.log(`Found ${invitationsNeedingThankYou.length} invitations needing thank you messages`);

      for (const invitation of invitationsNeedingThankYou) {
        try {
          await this.sendThankYouMessage(invitation);
        } catch (error) {
          this.logger.error(
            `Failed to send thank you message for invitation ${invitation.id}:`,
            error,
          );
        }
      }

      this.logger.log('Completed automation to send thank you messages');
    } catch (error) {
      this.logger.error('Error in sendThankYouMessages automation:', error);
    }
    this.logger.log('END Process sending thank you messages');
  }

  async sendThankYouMessage(
    invitation: Prisma.CampaignInvitationGetPayload<{
      include: { campaign: true };
    }>,
  ): Promise<void> {
    const campaign = invitation.campaign;

    // Skip if postEventTriggerAt is not set
    if (!campaign.postEventTriggerAt) {
      this.logger.warn(
        `Campaign ${campaign.id} does not have postEventTriggerAt set, skipping thank you message`,
      );
      return;
    }

    // Get related data
    const [talent, event] = await Promise.all([
      this.prisma.talent.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.event.findUnique({
        where: { id: invitation.eventId },
      }),
    ]);

    if (!campaign) {
      throw new Error(`Campaign with ID ${invitation.campaignId} not found`);
    }

    if (!talent) {
      throw new Error(`Talent with ID ${invitation.talentId} not found`);
    }

    if (!event) {
      throw new Error(`Event with ID ${invitation.eventId} not found`);
    }

    // Get talent's preferred language or default to 'en'
    let talentLang = talent.langPreferred || 'en';
    
    // Find spintax templates for postevent matching the talent's language or fallback to 'en'
    let spintaxTemplates = await this.prisma.campaignSpintaxTemplate.findMany({
      where: {
        campaignId: campaign.id,
        type: TemplateType.postevent,
        lang: {
          in: ['en', talent.langPreferred || 'en'],
        },
      },
    });
    
    let preferredTemplates = spintaxTemplates.filter(template => template.lang === talentLang);

    if (!preferredTemplates.length) {
      preferredTemplates = spintaxTemplates.filter(template => template.lang === 'en');
    }

    if(!preferredTemplates.length) {
      this.logger.warn(
        `No postevent spintax templates found for campaign ${campaign.id} with language ${talentLang} or 'en'`,
      );
      return;
    }

    // Select a random spintax template
    const randomTemplate =
      preferredTemplates[Math.floor(Math.random() * preferredTemplates.length)];

    this.logger.log(
      `Selected postevent template ${randomTemplate.id} for invitation ${invitation.id}`,
    );

    // Prepare template variables
    const variables = {
      name: talent.name,
      eventName: event.name,
      eventType: event.type,
      eventCity: event.city,
      eventDate: event.date.toLocaleDateString(),
      eventStartTime: event.start_time
        ? event.start_time.toLocaleTimeString()
        : '',
      eventEndTime: event.end_time ? event.end_time.toLocaleTimeString() : '',
    };

    // Render the template with variables using handlebar
    const message = renderTemplate(randomTemplate.content, variables);

    // Create the message entry
    await this.campaignMessagesService.createMessage({
      campaignId: campaign.id,
      promoterId: invitation.promoterId,
      invitationId: invitation.id,
      talentId: talent.id,
      direction: MessageDirection.sent,
      message: message,
      sentAt: new Date(),
    });

    // Update the invitation to mark thank you as sent
    await this.prisma.campaignInvitation.update({
      where: { id: invitation.id },
      data: {
        thankYouSent: true,
      },
    });

    this.logger.log(
      `Successfully sent thank you message for invitation ${invitation.id}`,
    );
  }
  
}


