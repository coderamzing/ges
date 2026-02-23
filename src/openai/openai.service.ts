import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: any;
  private isAvailable = false;
  private aiMode: "openai" | "deepseek" | "gemini";

  constructor(private configService: ConfigService) {
    this.aiMode = (this.configService.get("AI_MODE") || "openai") as any;
    this.initializeOpenAI();
  }

  private getModelByAIMode(): string {
    switch (this.aiMode) {
      case "openai":
        return "gpt-4o-mini";

      case "deepseek":
        return "deepseek-chat";

      case "gemini":
        return "google/gemini-2.5-flash-lite";

      default:
        this.logger.warn(
          `Unknown AI_MODE "${this.aiMode}", falling back to gpt-4o-mini`,
        );
        return "gpt-4o-mini";
    }
  }

  private initializeOpenAI() {
    this.logger.log(`AI mode : ${this.aiMode}`);

    try {
      if (this.aiMode === "openai") {
        const openaiModule = require("openai");
        const apiKey = this.configService.get<string>("OPENAI_API_KEY");

        if (!apiKey) {
          this.logger.warn(
            "OpenAI API key not found. OpenAI service will be disabled.",
          );
          return;
        }

        this.openai = new openaiModule({ apiKey });
        this.isAvailable = true;
        this.logger.log("OpenAI service initialized successfully");
      } else if (this.aiMode === "deepseek") {
        const openaiModule = require("openai");
        const apiKey = this.configService.get<string>("DEEPSEEK_API_KEY");

        if (!apiKey) {
          this.logger.warn(
            "Deepseek API key not found. Deepseek service will be disabled.",
          );
          return;
        }

        this.openai = new openaiModule({
          apiKey,
          baseURL: "https://api.deepseek.com/v1",
        });
        this.isAvailable = true;
        this.logger.log("Deepseek service initialized successfully");
      } else if (this.aiMode === "gemini") {
        const openaiModule = require("openai");
        const apiKey = this.configService.get<string>("GEMINI_API_KEY");
        if (!apiKey) {
          this.logger.warn(
            "Gemini API key not found. Gemini service will be disabled.",
          );
          return;
        }
     
        this.openai = new openaiModule({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
        });
        this.isAvailable = true;
        this.logger.log("Gemini service initialized successfully");
      }
    } catch (error: any) {
      this.logger.warn(`Failed to initialize AI service: ${error.message}`);
      this.isAvailable = false;
    }
  }

  async query(prompt: string, sysPrompt: string = ""): Promise<any> {
    if (!this.isAvailable || !this.openai) {
      throw new Error(`${this.aiMode} service is not available.`);
    }

    try {
      const model = this.getModelByAIMode();

      this.logger.log(`AI model used : ${model}`);
      const completion = await this.openai.chat.completions.create({
        model, 
        temperature: 0.2,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`AI API Error: ${error.message}`);
      if (error.response) {
        this.logger.error(`Details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }
}
