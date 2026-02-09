import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: any;
  private isAvailable = false;
  private aiMode: "openai" | "deepseek";

  constructor(private configService: ConfigService) {
    this.aiMode = (this.configService.get("AI_MODE") || "openai") as any;
    this.initializeOpenAI();
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

    const model = this.aiMode === "openai" ? "gpt-4o-mini" : "deepseek-chat";

    this.logger.log(`AI model used : ${model}`);
    console.log("AI model used : ", model)
    const completion = await this.openai.chat.completions.create({
      model, //gpt-4o-mini , gpt-4.1-mini , gpt-4.1-nano, deepseek-chat
      temperature: 0.2,
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    return JSON.parse(content);
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }
}
