import { Logger } from '@tradodesk/shared/src/logger';
import { LogEntry } from '@tradodesk/shared/src/types';

// Singleton Logger instance for Renderer
export const logger = new Logger("renderer");

// In-memory store for logs (capped)
export const logStore: LogEntry[] = [];
const MAX_LOGS = 500;

// Sink 1: Internal Store
logger.addSink((entry) => {
    logStore.unshift(entry);
    if (logStore.length > MAX_LOGS) logStore.pop();
});

// Sink 2: Browser Console (Stylized)
logger.addSink((entry) => {
    const style = entry.level === 'error' || entry.level === 'fatal' ? 'color: red; font-weight: bold' : 
                  entry.level === 'warn' ? 'color: orange' : 'color: #3b82f6';
    
    console.log(`%c[${entry.source.toUpperCase()}] ${entry.message}`, style, entry.data || '');
});

// Sink 3: IPC (Send to Main via allowlisted API)
if ((window as any).electron) {
    logger.addSink((entry) => {
        try {
            (window as any).electron.logEvent(entry);
        } catch (e) {
            console.error("Failed to send log to main process", e);
        }
    });
}
