import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignMessagesService } from '../campaign-messages/campaign-messages.service';
import { CampaignInvitationService } from './campaign-invitation.service';
import { InvitationStatus, MessageDirection, TemplateType, Prisma, CampaignStatus } from '@prisma/client';
import { renderTemplate } from 'utils/handlebar';

@Injectable()
export class CampaignInvitationAutomationService {
  private readonly logger = new Logger(CampaignInvitationAutomationService.name);

  private getRandomGapMs(): number {
    const minutes = Math.floor(Math.random() * 1) + 1; // 1, 2, or 3 minutes
    return minutes * 60 * 1000;
  }

  /**
   * Check if enough time has passed since last sent message for a promoter
   * Returns true if we should send, false if we should wait
   */
  private async shouldSendMessage(promoterId: bigint): Promise<boolean> {
    // Get the last sent message for this promoter
    const lastMessage = await this.prisma.campaignMessage.findFirst({
      where: {
        promoterId: promoterId,
        direction: MessageDirection.sent,
        sentAt: { not: null },
      },
      orderBy: {
        sentAt: 'desc',
      },
      select: {
        sentAt: true,
      },
    });

    if (!lastMessage || !lastMessage.sentAt) {
      return true; // No previous message, can send
    }

    const now = Date.now();
    const lastSent = lastMessage.sentAt.getTime();
    const randomGapMs = this.getRandomGapMs();

    return now - lastSent >= randomGapMs;
  }

  constructor(
    private prisma: PrismaService,
    private campaignMessagesService: CampaignMessagesService,
    private campaignInvitationService: CampaignInvitationService,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendInitialMessages() {
    this.logger.log('Process sending initial messages');

    try {
      // Find pending invitations that haven't been sent yet
      // Fetch multiple to check batch readiness and promoter delays
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
        orderBy: { id: 'asc' },
        take: 20, // Process up to 20 invitations per run
      });

      if (!pendingInvitations.length) {
        this.logger.log('No pending invitations to process for initial messages');
        return;
      }

      // Loop through invitations to find one that can be sent
      for (const invitation of pendingInvitations) {
        const promoterId = invitation.promoterId;
        // const campaignId = invitation.campaignId;
        // const batchId = invitation.batch;

        // First check if the batch can start for this invitation
        // try {
        //   const canStart = await this.campaignInvitationService.canStartBatch(
        //     campaignId,
        //     batchId,
        //     Number(promoterId),
        //   );

        //   if (!canStart) {
        //     this.logger.debug(
        //       `Skipping invitation ${invitation.id} - batch ${batchId} cannot start yet`,
        //     );
        //     continue; // Try next invitation
        //   }
        // } catch (error) {
        //   this.logger.warn(
        //     `Error checking batch readiness for invitation ${invitation.id}:`,
        //     error,
        //   );
        //   continue; // Skip this invitation if batch check fails
        // }

        // Then check if enough time has passed since last send for this promoter
        // if (!(await this.shouldSendMessage(promoterId))) {
        //   this.logger.debug(
        //     `Skipping invitation ${invitation.id} for promoter ${promoterId}, waiting for random gap`,
        //   );
        //   continue; // Try next invitation
        // }

        // Both conditions met - send the message
        try {
          await this.sendInitialMessage(invitation);
          this.logger.log(
            `Sent initial message for invitation ${invitation.id}, promoter ${promoterId}`,
          );
          // Successfully sent one message, exit the loop
          //break;
        } catch (error) {
          this.logger.error(
            `Failed to send initial message for invitation ${invitation.id}:`,
            error,
          );
          // Continue to next invitation on error
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
      this.prisma.talentPool.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.events.findUnique({
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
    let talentLang = talent.language || 'en';

    // Find spintax templates matching the talent's language or fallback to 'en'
    let spintaxTemplates = await this.prisma.campaignSpintaxTemplate.findMany({
      where: {
        campaignId: campaign.id,
        type: TemplateType.invitation,
        lang: {
          in: ['en', talent.language || 'en'],
        },
      },
    });

    let preferredTemplates = spintaxTemplates.filter(template => template.lang === talentLang);

    if (!preferredTemplates.length) {
      preferredTemplates = spintaxTemplates.filter(template => template.lang === 'en');
    }

    if (!preferredTemplates.length) {
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
      eventType: event.eventType || '',
      eventCity: event.city || '',
      eventDate: event.dt ? event.dt.toLocaleDateString() : '',
    };

    // Render the template with variables using handlebar
    const message = renderTemplate(randomTemplate.content, variables);

    // Create the message entry
    await this.campaignMessagesService.createMessage({
      campaignId: campaign.id,
      promoterId: Number(invitation.promoterId),
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
        status: InvitationStatus.sent,
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
      // Calculate the date 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Find invitations that need followup:
      // - followup = true (explicitly marked for followup)
      // - followupSent is false
      // - invitationAt is not null (initial message has been sent)
      // - invitationAt is at least 5 minutes ago
      const invitationsNeedingFollowup = await this.prisma.campaignInvitation.findMany({
        where: {
          AND: [
            { followup: true },
            { followupSent: false },
            { invitationAt: { not: null, lte: fiveMinutesAgo } },
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
        orderBy: { id: 'asc' },
        take: 1,
      });

      if (!invitationsNeedingFollowup.length) {
        this.logger.log('No invitations needing followup this run');
        return;
      }

      const invitation = invitationsNeedingFollowup[0];
      const promoterId = invitation.promoterId;

      // Check if enough time has passed since last send for this promoter
      if (!(await this.shouldSendMessage(promoterId))) {
        this.logger.debug(`Skipping followup for promoter ${promoterId}, waiting for random gap`);
        return;
      }

      try {
        await this.sendFollowupMessage(invitation);
        this.logger.log(`Sent followup message for invitation ${invitation.id}, promoter ${promoterId}`);
      } catch (error) {
        this.logger.error(
          `Failed to send followup message for invitation ${invitation.id}:`,
          error,
        );
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
      this.prisma.talentPool.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.events.findUnique({
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
    let talentLang = talent.language || 'en';

    // Find spintax templates for followup matching the talent's language or fallback to 'en'
    let spintaxTemplates = await this.prisma.campaignSpintaxTemplate.findMany({
      where: {
        campaignId: campaign.id,
        type: TemplateType.followup,
        lang: {
          in: ['en', talent.language || 'en'],
        },
      },
    });

    let preferredTemplates = spintaxTemplates.filter(template => template.lang === talentLang);

    if (!preferredTemplates.length) {
      preferredTemplates = spintaxTemplates.filter(template => template.lang === 'en');
    }

    if (!preferredTemplates.length) {
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
      eventType: event.eventType || '',
      eventCity: event.city || '',
      eventDate: event.dt ? event.dt.toLocaleDateString() : '',
    };
    // Render the template with variables using handlebar
    const message = renderTemplate(randomTemplate.content, variables);

    // Create the message entry
    await this.campaignMessagesService.createMessage({
      campaignId: campaign.id,
      promoterId: Number(invitation.promoterId),
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
      // const now = new Date();
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
            // { thankyou: true},
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
        orderBy: { id: 'asc' },
        take: 1,
      });

      if (!invitationsNeedingThankYou.length) {
        this.logger.log('No invitations needing thank you messages this run');
        return;
      }

      const invitation = invitationsNeedingThankYou[0];
      const promoterId = invitation.promoterId;

      // Check if enough time has passed since last send for this promoter
      if (!(await this.shouldSendMessage(promoterId))) {
        this.logger.debug(`Skipping thank you for promoter ${promoterId}, waiting for random gap`);
        return;
      }

      try {
        await this.sendThankYouMessage(invitation);
        this.logger.log(`Sent thank you message for invitation ${invitation.id}, promoter ${promoterId}`);
      } catch (error) {
        this.logger.error(
          `Failed to send thank you message for invitation ${invitation.id}:`,
          error,
        );
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
      this.prisma.talentPool.findUnique({
        where: { id: invitation.talentId },
      }),
      this.prisma.events.findUnique({
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
    let talentLang = talent.language || 'en';

    // Find spintax templates for postevent matching the talent's language or fallback to 'en'
    let spintaxTemplates = await this.prisma.campaignSpintaxTemplate.findMany({
      where: {
        campaignId: campaign.id,
        type: TemplateType.postevent,
        lang: {
          in: ['en', talent.language || 'en'],
        },
      },
    });

    let preferredTemplates = spintaxTemplates.filter(template => template.lang === talentLang);

    if (!preferredTemplates.length) {
      preferredTemplates = spintaxTemplates.filter(template => template.lang === 'en');
    }

    if (!preferredTemplates.length) {
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
      eventType: event.eventType || '',
      eventCity: event.city || '',
      eventDate: event.dt ? event.dt.toLocaleDateString() : '',
    };

    // Render the template with variables using handlebar
    const message = renderTemplate(randomTemplate.content, variables);

    // Create the message entry
    await this.campaignMessagesService.createMessage({
      campaignId: campaign.id,
      promoterId: Number(invitation.promoterId),
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


