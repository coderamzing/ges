import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";
import { Message } from "@prisma/client";
import { renderTemplate } from "utils/handlebar";

interface LocationInterpretationResponse {
  currentCity?: string | null;
  futureCity?: string | null;
  currentCountry?: string | null;
  currentContinent?: string | null;
  futureCityStartAt?: string | null;
  futureCityEndAt?: string | null;
  currentCityEndAt?: string | null;
  cityHome?: string | null;
  futureContinent?: string | null;
  futureCountry?: string | null;
}

@Injectable()
export class LocationAutomationService {
  private readonly logger = new Logger(LocationAutomationService.name);
  private prompt: any;

  constructor(
    private prisma: PrismaService,
    private openAIService: OpenAIService,
  ) {}

  /**
   * Process messages to extract location information
   * Fetches all new messages, groups by thread_id and talent, and interprets location data
   * Runs every minute via cron
   */
  @Cron(CronExpression.EVERY_2_HOURS)
  async processLastMinuteMessages(): Promise<void> {
    try {
      // Get the LOCATION_INTERPRETATION prompt
      this.prompt = await this.prisma.aiPrompt.findFirst({
        where: {
          key: "LOCATION_INTERPRETATION",
        },
      });

      if (!this.prompt) {
        this.logger.warn("LOCATION_INTERPRETATION prompt not found");
        return;
      }

      // Fetch all new messages with thread_id created in the last minute
      const twoHourAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

      const messages = await this.prisma.message.findMany({
        where: {
          ai_city_detected: null,
          thread_id: { not: null },
          created_at: {
            gte: fourHoursAgo,
            lte: twoHourAgo,
          },
        },
        select: {
          id: true,
          thread_id: true,
          sender_username: true,
          created_at: true,
        },
        orderBy: {
          created_at: "asc",
        },
      });

      if (messages.length === 0) {
        this.logger.log("No new messages to process for location");
        return;
      }

      // Process each group
      for (const message of messages) {
        if (!message.thread_id || !message.sender_username) continue;

        // const DAYS = 3;
        // const sevenDaysAgo = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

        const lastMessages = await this.prisma.message.findMany({
          select: {
            message: true,
            created_at: true,
            sender_username: true,
            tm: true,
          },
          where: {
            thread_id: message.thread_id,
          },
          orderBy: {
            tm: "desc",
          },
          take: 5,
        });

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const lastMessage = lastMessages[0];

        const lastMessageTime = lastMessage?.created_at;

        // If we still don’t have a timestamp, skip safely
        if (!lastMessageTime) {
          continue;
        }

        // If last message is within last 2 hours → skip
        if (lastMessageTime > twoHoursAgo) {
          // Conversation is still active, skip
          continue;
        }

        // Get all previous messages in the thread for this talent (reverse order - oldest to newest)
        const last15MessagesDesc = await this.prisma.message.findMany({
          select: {
            message: true,
            created_at: true,
            sender_username: true,
            tm: true,
          },
          where: {
            thread_id: message.thread_id,
          },
          orderBy: {
            tm: "desc",
          },
          take: 15,
        });

        const allThreadMessages = last15MessagesDesc.reverse();
        const thread = await this.prisma.thread.findUnique({
          where: {
            id: message.thread_id,
          },
        });

        // if (!thread) {
        //     throw new NotFoundException(`Thread not found: ${message.thread_id}`);
        // }
        if (!thread) {
          this.logger.log(" Thread not found:", message.thread_id);
          continue; // skip this message, don't crash cron
        }

        if (!thread || !thread.username2) continue;

        const talentUsername = thread.username2;
        const promoterUsername = thread.username1;

        const talent = await this.prisma.talentPool.findUnique({
          where: {
            id: message.sender_username,
          },
        });
        if (!talent) continue;

        // Create full message thread (reverse - oldest to newest)
        const fullMessage =
          `Today's Date: ${new Date().toDateString()}\n\n` +
          // (talent.name ? `Talent Name: ${talent?.name}\n\n` : "") +
          // `Talent City: ${talent?.currentCity || ""}\n\n` +
          `Conversation:\n\n` +
          allThreadMessages
            .map((msg) => {
              let label = "Unknown";

              if (talentUsername && msg.sender_username === talentUsername) {
                label = "Talent";
              } else if (
                promoterUsername &&
                msg.sender_username === promoterUsername
              ) {
                label = "Promoter";
              }

              return `[${msg.tm?.toISOString() || msg.created_at?.toISOString()}] ${label}: ${msg.message}`;
            })
            .join("\n\n");
        await this.processTalentLocation(
          message as unknown as Message,
          talent.id,
          fullMessage,
        );
      }
    } catch (error) {
      this.logger.error(
        "Error processing last minute messages for location:",
        error,
      );
      throw error;
    }
  }

  /**
   * Convert string 'null' to actual null, or return the value as is
   */
  private parseNullString(value: string | null | undefined): string | null {
    if (!value || value === "null" || value === "NULL" || value.trim() === "") {
      return null;
    }
    return value;
  }

  /**
   * Convert a date string to UTC Date object, or return null if invalid/null
   */
  private async convertToUTC(
    date: string | null | undefined,
  ): Promise<Date | null> {
    // Handle null or 'null' string
    const parsedDate = this.parseNullString(date);
    if (!parsedDate) {
      return null;
    }

    // Check if the input is a valid date string
    const parsed = Date.parse(parsedDate);
    if (isNaN(parsed)) {
      this.logger.warn(`Invalid date provided: ${date}, returning null`);
      return null;
    }

    const d = new Date(parsedDate);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Process location information for a specific talent
   */
  private async processTalentLocation(
    message: Message,
    talentId: string,
    fullMessage: string,
  ): Promise<void> {
    try {
      if (!talentId) {
        throw new Error(`No talentId provided for message ${message.id}`);
      }

      // Prepare the prompt
      const prompt = renderTemplate(this.prompt.defs, {
        messages: fullMessage,
      });

      const sysPrompt = this.prompt.role;

      // Call OpenAI to interpret location
      let interpretation: LocationInterpretationResponse;
      try {
        const response = await this.openAIService.query(prompt, sysPrompt);
        this.logger.log(
          `Location interpretation response for talent ${talentId}:`,
          response,
        );

        interpretation = {
          currentCity: this.parseNullString(response.currentCity),
          futureCity: this.parseNullString(response.futureCity),
          futureCityStartAt: response.futureCityStartAt,
          futureCityEndAt: response.futureCityEndAt,
          currentCityEndAt: response.currentCityEndAt,
          cityHome: this.parseNullString(response.cityHome),
          currentCountry: this.parseNullString(response.currentCountry),
          currentContinent: this.parseNullString(response.currentContinent),
          futureCountry: this.parseNullString(response.futureCountry),
          futureContinent: this.parseNullString(response.futureContinent),
        };
      } catch (error) {
        throw new Error(
          `Error calling OpenAI for location interpretation - talent ${talentId}:`,
        );
      }

      const data: any = {};
      //future city
      if (interpretation.futureCity) {
        const startUTC = interpretation.futureCityStartAt
          ? await this.convertToUTC(interpretation.futureCityStartAt)
          : null;

        const endUTC = interpretation.futureCityEndAt
          ? await this.convertToUTC(interpretation.futureCityEndAt)
          : null;

        const defaultEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        data.futureCity = interpretation.futureCity;
        data.futureCityStartAt = startUTC;
        data.futureCityEndAt = endUTC ?? defaultEnd;
        data.futureCountry = interpretation.futureCountry;
        data.futureContinent = interpretation.futureContinent;
      }

      // Current city and city update
      if (interpretation.currentCity) {
        data.currentCity = interpretation.currentCity;
        data.city = interpretation.currentCity;
        data.country = interpretation.currentCountry;
        data.continent = interpretation.currentContinent;
        data.storyDateTime = new Date();

        if (interpretation.currentCityEndAt) {
          data.currentCityEndAt = await this.convertToUTC(
            interpretation.currentCityEndAt,
          );
        }
      }

      // City home
      if (interpretation.cityHome) {
        data.cityHome = interpretation.cityHome;
        data.cityHomeUpdated = new Date();
      }

      // Only update if there is something to update
      if (Object.keys(data).length > 0) {
        await this.prisma.talentPool.update({
          where: { id: talentId },
          data,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error processing location for message ${message.id}:`,
        error,
      );
      throw error;
    } finally {
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          ai_city_detected: "true",
        },
      });

      this.logger.log(`Processed location for talent ${talentId}`);
    }
  }
}
