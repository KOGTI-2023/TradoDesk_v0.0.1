import React, { useEffect, useState } from 'react';
import { logStore } from '../services/logging';
import { LogEntry } from '@tradodesk/shared/src/types';

export const LogPanel: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        // Polling loop for simple reactivity (in real app, use store subscription)
        const interval = setInterval(() => {
            setLogs([...logStore].slice(0, 50)); 
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-40 bg-slate-950 border-t border-slate-800 p-2 overflow-y-auto font-mono text-xs flex flex-col-reverse">
            {logs.map((log, i) => (
                <div key={i} className={`mb-0.5 break-words ${
                    log.level === 'error' || log.level === 'fatal' ? 'text-red-400' : 
                    log.level === 'warn' ? 'text-orange-300' : 'text-slate-400'
                }`}>
                    <span className="text-slate-600 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    {log.message}
                </div>
            ))}
            <div className="text-slate-500 mb-1 font-bold sticky top-0 bg-slate-950">SYSTEM LOGS</div>
        </div>
    );
};
