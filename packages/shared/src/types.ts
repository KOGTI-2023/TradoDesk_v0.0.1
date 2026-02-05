export enum IpcChannels {
  LLM_REQUEST = "LLM_REQUEST",
  LLM_STREAM = "LLM_STREAM",
  BROKER_SCREENSHOT = "BROKER_SCREENSHOT",
  AUTOMATION_RUN = "AUTOMATION_RUN",
  GET_CONFIG = "GET_CONFIG",
  SAVE_CONFIG = "SAVE_CONFIG",
  GET_USAGE = "GET_USAGE",
  RESET_USAGE = "RESET_USAGE",
  LOG_ENTRY = "LOG_ENTRY",
  ON_APP_ERROR = "ON_APP_ERROR",
  REQUEST_ACTION = "REQUEST_ACTION",
  GET_BOOT_INFO = "GET_BOOT_INFO"
}

export enum ModelLane {
  FAST = "gemini-2.5-flash-lite",
  DEEP = "gemini-3-pro-preview"
}

export interface AppConfig {
  demoMode: boolean;
  secureMode: boolean;
  logLevel: "info" | "debug" | "error";
  rateLimitMs: number;
  pricing: Record<string, { input: number; output: number }>; // Cost per 1M tokens
}

export interface UsageRecord {
  id: string;
  timestamp: number;
  model: string;
  lane: "fast" | "deep";
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: number;
}

export interface BootInfo {
  config: AppConfig;
  env: { API_KEY?: string };
  usage: UsageRecord[];
}

export interface LlmRequest {
  messages: Array<{ role: "user" | "model" | "system"; content: string; image?: string }>; // base64 image
  lane: "fast" | "deep";
  thinking?: boolean;
}

export interface AutomationTask {
  action: "place_order" | "get_data";
  payload: Record<string, any>;
  dryRun: boolean;
}

// --- Error Management ---

export enum ErrorCode {
  UNKNOWN = "UNKNOWN",
  IPC_VALIDATION_FAILED = "IPC_VALIDATION_FAILED",
  LLM_QUOTA_EXCEEDED = "LLM_QUOTA_EXCEEDED",
  LLM_RATE_LIMIT = "LLM_RATE_LIMIT",
  LLM_AUTH_FAILED = "LLM_AUTH_FAILED",
  LLM_SERVICE_ERROR = "LLM_SERVICE_ERROR",
  AUTOMATION_TIMEOUT = "AUTOMATION_TIMEOUT",
  AUTOMATION_BLOCKED = "AUTOMATION_BLOCKED",
  CONFIG_LOAD_FAILED = "CONFIG_LOAD_FAILED",
  RENDER_CRASH = "RENDER_CRASH",
  MAIN_PROCESS_CRASH = "MAIN_PROCESS_CRASH"
}

export type AppSeverity = "info" | "warn" | "error" | "fatal";

export interface AppError {
  code: ErrorCode;
  message_de: string;
  details?: Record<string, unknown>;
  severity: AppSeverity;
  retryable: boolean;
  suggested_action_de: string;
  correlation_id: string;
  timestamp_iso: string;
  cause?: string; // Serialized cause
}

export type Result<T, E = AppError> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

// --- Logging ---

export interface LogEntry {
  timestamp: number;
  level: AppSeverity;
  message: string;
  correlationId?: string;
  data?: any;
  source: "main" | "renderer" | "automation";
}
