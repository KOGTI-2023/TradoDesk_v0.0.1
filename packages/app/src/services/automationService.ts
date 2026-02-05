import { AutomationTask, Result, ErrorCode } from "@tradodesk/shared/src/types";
import { toAppError, ok, fail } from "@tradodesk/shared/src/errorUtils";
import { logger } from "./logging";

/**
 * Service to interact with the Playwright automation process via Electron IPC.
 * Enforces Result<T> pattern for safer consumption in the UI.
 */
export class AutomationService {
  /**
   * Runs an automation task.
   * @param task The task configuration (action, payload, dryRun).
   * @param correlationId Optional ID for tracing logs.
   */
  async runTask(task: AutomationTask, correlationId?: string): Promise<Result<{ message: string; data?: any }>> {
    const electron = (window as any).electron;

    if (!electron) {
      const err = toAppError("Electron IPC not available (Web Mode?)", ErrorCode.UNKNOWN, undefined, correlationId);
      return fail(err);
    }

    try {
      logger.info(`Calling automation service: ${task.action}`, correlationId, { dryRun: task.dryRun });
      
      const rawResponse = await electron.runAutomation(task);

      if (!rawResponse) {
        return fail(toAppError("Empty response from automation service", ErrorCode.IPC_VALIDATION_FAILED, undefined, correlationId));
      }

      if (rawResponse.success) {
        return ok({ message: rawResponse.message, data: rawResponse.data });
      } else {
        // Handle explicit logic failures from Main/Automation
        const errorMsg = rawResponse.error || "Automation failed with unknown error";
        
        // Map unknown errors to AUTOMATION_BLOCKED as a safe default for logic failures, 
        // unless it's clearly a timeout/crash
        const errorCode = errorMsg.toLowerCase().includes('timeout') 
            ? ErrorCode.AUTOMATION_TIMEOUT 
            : ErrorCode.AUTOMATION_BLOCKED;

        return fail(toAppError(
          errorMsg, 
          errorCode,
          { raw: rawResponse },
          correlationId
        ));
      }

    } catch (error: any) {
      logger.error("Automation Service IPC Error", correlationId, { error });
      
      // Explicitly map network/timeout errors during IPC transport
      const msg = (error.message || '').toLowerCase();
      let code = ErrorCode.LLM_SERVICE_ERROR; // Default fallthrough for IPC generic errors
      
      if (msg.includes('timeout') || msg.includes('timed out')) {
          code = ErrorCode.AUTOMATION_TIMEOUT;
      } else if (msg.includes('ipc') || msg.includes('channel')) {
          code = ErrorCode.IPC_VALIDATION_FAILED;
      }

      return fail(toAppError(error, code, undefined, correlationId));
    }
  }
}