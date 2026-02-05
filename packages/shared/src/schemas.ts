import { z } from 'zod';

export const GeminiUsageSchema = z.object({
  promptTokenCount: z.number().int().nonnegative().optional(),
  candidatesTokenCount: z.number().int().nonnegative().optional(),
  totalTokenCount: z.number().int().nonnegative().optional(),
});

export const GeminiFunctionCallSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.any()).optional().nullable(),
  id: z.string().optional()
});

export const GeminiContentSuccessSchema = z.object({
  text: z.string().optional(),
  usage: GeminiUsageSchema.optional(),
  functionCalls: z.array(GeminiFunctionCallSchema).optional()
});

export const GeminiStreamChunkSchema = z.object({
  text: z.string().optional(),
  usage: GeminiUsageSchema.optional(),
});

// --- IPC Schemas ---

export const LogEventSchema = z.object({
  timestamp: z.number(),
  level: z.enum(['info', 'warn', 'error', 'fatal']),
  message: z.string(),
  correlationId: z.string().optional(),
  data: z.any().optional(),
  source: z.enum(['main', 'renderer', 'automation'])
});

export const RequestActionSchema = z.object({
  type: z.enum(['GET_CONFIG', 'SAVE_CONFIG', 'GET_USAGE', 'RESET_USAGE', 'RUN_AUTOMATION', 'STORE_SECRET', 'GET_SECRET']),
  payload: z.any().optional(),
  correlationId: z.string().optional()
});