import { LogEntry, AppSeverity } from './types';

type LogSink = (entry: LogEntry) => void;

export class Logger {
    private sinks: LogSink[] = [];
    private source: "main" | "renderer" | "automation";

    constructor(source: "main" | "renderer" | "automation") {
        this.source = source;
    }

    addSink(sink: LogSink) {
        this.sinks.push(sink);
    }

    private log(level: AppSeverity, message: string, correlationId?: string, data?: any) {
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            correlationId,
            data: this.sanitize(data),
            source: this.source
        };
        this.sinks.forEach(sink => sink(entry));
    }

    info(message: string, correlationId?: string, data?: any) { this.log('info', message, correlationId, data); }
    warn(message: string, correlationId?: string, data?: any) { this.log('warn', message, correlationId, data); }
    error(message: string, correlationId?: string, data?: any) { this.log('error', message, correlationId, data); }
    fatal(message: string, correlationId?: string, data?: any) { this.log('fatal', message, correlationId, data); }

    private sanitize(data: any): any {
        if (!data) return undefined;
        try {
            return JSON.parse(JSON.stringify(data, (key, value) => {
                // Redact Secrets
                if (/key|token|auth|password|secret/i.test(key)) return '***REDACTED***';
                // Truncate Base64 images
                if (typeof value === 'string' && value.startsWith('data:image') && value.length > 200) {
                    return value.substring(0, 50) + '...[TRUNCATED_IMAGE]';
                }
                return value;
            }));
        } catch {
            return '[Sanitization Failed]';
        }
    }
}
