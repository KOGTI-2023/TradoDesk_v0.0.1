import { AppError, ErrorCode, AppSeverity, Result } from './types';
import { z } from 'zod';

export const createCorrelationId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

export const toAppError = (
  err: unknown, 
  code: ErrorCode = ErrorCode.UNKNOWN, 
  context?: Record<string, unknown>,
  correlationId?: string
): AppError => {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const stack = err instanceof Error ? err.stack : undefined;
  
  // Defaults
  let severity: AppSeverity = "error";
  let retryable = false;
  let message_de = "Ein unbekannter Fehler ist aufgetreten.";
  let suggested_action_de = "Bitte versuche es erneut oder starte die App neu.";

  // Specific Error Mapping
  if (message.includes("quota") || message.includes("exhausted")) {
      code = ErrorCode.LLM_QUOTA_EXCEEDED;
      message_de = "Dein KI-Guthaben oder Limit ist erschöpft.";
      suggested_action_de = "Überprüfe dein Billing im Google Cloud Console oder warte bis zum Reset.";
      retryable = false;
      severity = "warn";
  } else if (message.includes("429") || message.includes("too many requests")) {
      code = ErrorCode.LLM_RATE_LIMIT;
      message_de = "Zu viele Anfragen in kurzer Zeit (Rate Limit).";
      suggested_action_de = "Warte einen Moment, bevor du eine neue Anfrage stellst.";
      retryable = true;
      severity = "warn";
  } else if (message.includes("api_key") || message.includes("401") || message.includes("403")) {
      code = ErrorCode.LLM_AUTH_FAILED;
      message_de = "Der API-Schlüssel wurde abgelehnt.";
      suggested_action_de = "Bitte prüfe den API-Key in den Einstellungen.";
      severity = "error";
      retryable = false;
  } else if (message.includes("503") || message.includes("overloaded") || message.includes("internal")) {
      code = ErrorCode.LLM_SERVICE_ERROR;
      message_de = "Der KI-Dienst ist momentan überlastet oder nicht erreichbar.";
      suggested_action_de = "Versuche es in ein paar Sekunden erneut.";
      severity = "error";
      retryable = true;
  } else if (message.includes("network") || message.includes("fetch")) {
      code = ErrorCode.LLM_SERVICE_ERROR;
      message_de = "Netzwerkfehler beim Verbinden zum KI-Dienst.";
      suggested_action_de = "Prüfe deine Internetverbindung.";
      severity = "warn";
      retryable = true;
  }

  // Override if code is passed explicitly
  if (code === ErrorCode.AUTOMATION_BLOCKED) {
      message_de = "Aktion im Demo-Modus blockiert.";
      suggested_action_de = "Deaktiviere den Demo-Modus in den Einstellungen, um echte Orders auszuführen.";
      severity = "warn";
      retryable = false;
  }

  return {
    code,
    message_de,
    details: { originalMessage: message, ...context },
    severity,
    retryable,
    suggested_action_de,
    correlation_id: correlationId || createCorrelationId(),
    timestamp_iso: new Date().toISOString(),
    cause: stack
  };
};

export const serializeAppError = (err: AppError): string => {
    // Redact potential secrets in details
    const safeDetails = JSON.parse(JSON.stringify(err.details || {}, (key, value) => {
        if (/key|token|auth/i.test(key)) return '***REDACTED***';
        return value;
    }));
    return JSON.stringify({ ...err, details: safeDetails });
};

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T>(error: AppError): Result<T> => ({ ok: false, error });

// --- Schemas for IPC Validation ---

export const AutomationTaskSchema = z.object({
  action: z.enum(["place_order", "get_data"]),
  payload: z.record(z.string(), z.any()),
  dryRun: z.boolean()
});

export const UsageRecordSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  model: z.string(),
  lane: z.enum(["fast", "deep"]),
  promptTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  latencyMs: z.number(),
  cost: z.number()
});