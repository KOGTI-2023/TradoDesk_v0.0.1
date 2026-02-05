import React, { ReactNode, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { logger } from './services/logging';
import { AppError, ErrorCode } from '@tradodesk/shared/src/types';
import { toAppError, createCorrelationId } from '@tradodesk/shared/src/errorUtils';

// --- Global Error Handlers ---
window.onerror = (message, source, lineno, colno, error) => {
    logger.fatal("Uncaught Exception", undefined, { message, source, lineno, error: String(error) });
};

window.onunhandledrejection = (event) => {
    logger.error("Unhandled Rejection", undefined, { reason: event.reason });
};

// --- Error Boundary ---
interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    appError: AppError | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, appError: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        const corrId = createCorrelationId();
        const appError = toAppError(error, ErrorCode.RENDER_CRASH, undefined, corrId);
        return { hasError: true, appError };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        if (this.state.appError) {
            logger.fatal("Render Crash", this.state.appError.correlation_id, { errorInfo });
        }
    }

    render() {
        if (this.state.hasError && this.state.appError) {
            const err = this.state.appError;
            return (
                <div className="fixed inset-0 bg-slate-950 text-white p-10 font-sans flex flex-col items-center justify-center z-[9999]">
                    <div className="max-w-xl w-full bg-slate-900 border border-red-800 rounded-lg p-6 shadow-2xl">
                        <h1 className="text-2xl font-bold text-red-400 mb-4">Etwas ist schiefgelaufen 😵</h1>
                        <p className="text-slate-300 mb-6">{err.message_de}</p>
                        
                        <div className="bg-slate-950 p-4 rounded mb-6 text-sm font-mono text-slate-400 border border-slate-800">
                            <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Fehlerdetails</p>
                            <p><span className="text-indigo-400">Code:</span> {err.code}</p>
                            <p><span className="text-indigo-400">ID:</span> {err.correlation_id}</p>
                            <p className="mt-2 text-xs text-slate-500">{err.suggested_action_de}</p>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors"
                            >
                                Neu laden
                            </button>
                            <button 
                                onClick={() => this.setState({ hasError: false })}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition-colors"
                            >
                                Versuchen zu ignorieren
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// --- Diagnostics Overlay ---
const DiagnosticsOverlay: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [envInfo, setEnvInfo] = useState<any>({});

    useEffect(() => {
        const interval = setInterval(() => {
            if (isOpen) {
                // Pull from logStore (imported dynamically to avoid circular deps if in same file)
                import('./services/logging').then(mod => {
                    setLogs([...mod.logStore].slice(0, 50));
                });
            }
        }, 1000);
        
        // Detect Env
        const hasElectron = !!(window as any).electron;
        setEnvInfo({
            mode: hasElectron ? 'ELECTRON' : 'WEB_PREVIEW (Mock)',
            url: window.location.href,
            root: !!document.getElementById('root')
        });

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-0 right-0 z-[10000] bg-slate-800/50 text-[10px] text-slate-500 px-2 py-1 rounded-tl hover:bg-slate-700 hover:text-white transition-all"
            >
                Diagnose
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/95 z-[9999] p-8 font-mono text-xs text-green-400 overflow-auto">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6 border-b border-green-900 pb-2">
                    <h2 className="text-lg font-bold">Systemdiagnose</h2>
                    <button onClick={() => setIsOpen(false)} className="text-red-400 border border-red-900 px-3 py-1 hover:bg-red-900/30 rounded">
                        Schließen
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="bg-slate-900/50 p-4 rounded border border-slate-800">
                        <h3 className="text-slate-400 mb-2 uppercase tracking-widest">Umgebung</h3>
                        <ul className="space-y-1">
                            <li>Modus: <span className={envInfo.mode.includes('Mock') ? 'text-yellow-400' : 'text-green-400'}>{envInfo.mode}</span></li>
                            <li>URL: <span className="text-slate-500">{envInfo.url}</span></li>
                            <li>Root Mount: <span className={envInfo.root ? 'text-green-400' : 'text-red-500'}>{String(envInfo.root)}</span></li>
                        </ul>
                    </div>
                </div>

                <h3 className="text-slate-400 mb-2 uppercase tracking-widest">Live Logs (Letzte 50)</h3>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded h-[500px] overflow-y-auto whitespace-pre-wrap">
                    {logs.map((log, i) => (
                        <div key={i} className={`mb-1 border-b border-slate-800/30 pb-1 break-words ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-orange-400' : 'text-slate-300'}`}>
                            <span className="text-slate-600 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            <span className="font-bold mr-2">[{log.level.toUpperCase()}]</span>
                            {log.correlationId && <span className="text-purple-400 mr-2">#{log.correlationId}</span>}
                            {log.message}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Boot ---
const rootEl = document.getElementById('root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
                <DiagnosticsOverlay />
            </ErrorBoundary>
        </React.StrictMode>
    );
    logger.info("App mounted successfully.");
} else {
    logger.fatal("Root element missing. Critical boot failure.");
}
