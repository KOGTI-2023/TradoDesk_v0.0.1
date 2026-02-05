import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ModelLane, AppError, ErrorCode, Result } from "@tradodesk/shared/src/types";
import { toAppError, ok, fail } from "@tradodesk/shared/src/errorUtils";
import { GeminiContentSuccessSchema, GeminiStreamChunkSchema } from "@tradodesk/shared/src/schemas";
import { logger } from "./logging";

const tools = [
  {
    functionDeclarations: [
      {
        name: 'place_order',
        description: 'Places a trade order. REQUIRES USER CONFIRMATION.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            action: { type: Type.STRING, enum: ['BUY', 'SELL'] },
            quantity: { type: Type.NUMBER },
          },
          required: ['symbol', 'action', 'quantity']
        }
      },
      {
        name: 'get_chart',
        description: 'Gets chart data for a symbol',
        parameters: {
            type: Type.OBJECT,
            properties: { symbol: { type: Type.STRING } },
            required: ['symbol']
        }
      }
    ]
  }
];

export class GeminiService {
  private ai: GoogleGenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Executes an operation with exponential backoff retry logic.
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    correlationId?: string,
    maxRetries: number = 3
  ): Promise<T> {
    let attempt = 0;
    
    while (true) {
      try {
        return await operation();
      } catch (err: any) {
        // Map error to check if it's retryable
        const appError = toAppError(err, ErrorCode.UNKNOWN, undefined, correlationId);
        
        if (!appError.retryable || attempt >= maxRetries) {
          throw err;
        }

        attempt++;
        const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        
        logger.warn(
            `Gemini API Retry (${attempt}/${maxRetries}) detected. Waiting ${delay}ms.`, 
            correlationId, 
            { code: appError.code, originalMessage: err.message }
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Generates content in a single shot (non-streaming).
   * Validates response against Zod schema.
   */
  async generateContent(
    prompt: string,
    lane: ModelLane,
    image?: string, // Base64
    correlationId?: string
  ): Promise<Result<{ text?: string; usage?: any; functionCalls?: any[] }>> {
    if (!this.apiKey) {
      return fail(toAppError("API Key missing", ErrorCode.LLM_AUTH_FAILED, undefined, correlationId));
    }

    const contents = this.buildContents(prompt, image);
    const modelId = lane;
    const isDeep = lane === ModelLane.DEEP;
    const thinkingConfig = isDeep ? { thinkingConfig: { thinkingBudget: 1024 } } : undefined;

    try {
      logger.info(`Starting generateContent request to ${modelId}`, correlationId);
      
      const response = await this.withRetry(async () => {
        return await this.ai.models.generateContent({
            model: modelId,
            contents: contents as any,
            config: {
            systemInstruction: this.getSystemInstruction(),
            tools: isDeep ? undefined : tools,
            ...thinkingConfig
            }
        });
      }, correlationId);

      // Extract text safely
      let extractedText: string | undefined;
      try {
        extractedText = response.text;
      } catch (e) {
        // Text might be missing if blocked or only function calls present
      }

      const rawResult = {
        text: extractedText,
        usage: response.usageMetadata,
        functionCalls: response.functionCalls
      };

      // Strict Schema Validation
      const validation = GeminiContentSuccessSchema.safeParse(rawResult);
      if (!validation.success) {
        logger.error("Gemini Response Validation Failed", correlationId, validation.error);
        return fail(toAppError(
          "API response validation failed (Structure Mismatch)", 
          ErrorCode.IPC_VALIDATION_FAILED, 
          { zod: validation.error.format() }, 
          correlationId
        ));
      }

      return ok(validation.data);
    } catch (error) {
      logger.error("Gemini API generateContent Error", correlationId, { error });
      
      const finalError = toAppError(error, ErrorCode.LLM_SERVICE_ERROR, undefined, correlationId);
      // Add user-friendly German message for final exhaustion
      if (finalError.retryable) {
          finalError.message_de = "Verbindung zum KI-Dienst fehlgeschlagen (trotz mehrerer Versuche).";
      }
      return fail(finalError);
    }
  }

  /**
   * Streams response content.
   * Validates each chunk against Zod schema.
   */
  async *streamResponse(
    prompt: string, 
    lane: ModelLane, 
    history: any[], 
    image?: string, // Base64
    correlationId?: string
  ): AsyncGenerator<Result<{ text?: string; usage?: any }>> {
    
    if (!this.apiKey) {
        yield fail(toAppError("API Key missing", ErrorCode.LLM_AUTH_FAILED, undefined, correlationId));
        return;
    }

    const contents = [...history];
    const newContent = this.buildContents(prompt, image);
    contents.push(newContent[0]);

    const modelId = lane;
    const isDeep = lane === ModelLane.DEEP;
    const thinkingConfig = isDeep ? { thinkingConfig: { thinkingBudget: 1024 } } : undefined;

    try {
      logger.info(`Starting stream request to ${modelId}`, correlationId);
      
      // Retry applies to connection establishment
      const responseStream = await this.withRetry(async () => {
          return await this.ai.models.generateContentStream({
            model: modelId,
            contents: contents as any, 
            config: {
                systemInstruction: this.getSystemInstruction(),
                tools: isDeep ? undefined : tools,
                ...thinkingConfig
            }
          });
      }, correlationId);

      for await (const chunk of responseStream) {
        let chunkText: string | undefined;
        try { chunkText = chunk.text; } catch {}

        const rawChunk = {
            text: chunkText,
            usage: chunk.usageMetadata 
        };

        // Strict Schema Validation per Chunk
        const validation = GeminiStreamChunkSchema.safeParse(rawChunk);
        
        if (!validation.success) {
            logger.error("Gemini Stream Chunk Validation Failed", correlationId, validation.error);
            yield fail(toAppError(
                "Stream chunk validation failed", 
                ErrorCode.IPC_VALIDATION_FAILED, 
                { zod: validation.error.format() }, 
                correlationId
            ));
            return; 
        }

        yield ok(validation.data);
      }
    } catch (error) {
      logger.error("Gemini API streamResponse Error", correlationId, { error });
      const finalError = toAppError(error, ErrorCode.LLM_SERVICE_ERROR, undefined, correlationId);
      if (finalError.retryable) {
          finalError.message_de = "Verbindung zum KI-Dienst konnte nicht hergestellt werden (Max Retries).";
      }
      yield fail(finalError);
    }
  }

  private buildContents(prompt: string, image?: string) {
    if (image) {
        return [{
            role: "user",
            parts: [
                { inlineData: { mimeType: "image/png", data: image.split(',')[1] } },
                { text: "Analysiere diesen Chart. " + prompt }
            ]
        }];
    } else {
        return [{ role: "user", parts: [{ text: prompt }] }];
    }
  }

  private getSystemInstruction() {
      return "Du bist ein professioneller Trading-Assistent. Antworte immer auf Deutsch (informelles 'du'). Sei präzise, risikobewusst und hilfsbereit. WARNUNG: Dies ist ein Demo-Konto.";
  }
}