import { create } from 'zustand';
import { AppConfig, UsageRecord, ModelLane, BootInfo } from '@tradodesk/shared/src/types';
import { logger } from '../services/logging';
import { createCorrelationId } from '@tradodesk/shared/src/errorUtils';

interface AppState {
  config: AppConfig;
  usageStats: UsageRecord[];
  apiKey: string | null;
  loadConfig: () => Promise<void>;
  addUsageRecord: (record: UsageRecord) => void;
  setApiKey: (key: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  config: {
    demoMode: true,
    secureMode: true,
    logLevel: 'info',
    rateLimitMs: 800,
    pricing: {}
  },
  usageStats: [],
  apiKey: null, 

  loadConfig: async () => {
    const electron = (window as any).electron;
    
    if (electron) {
        try {
            // New API Call
            const bootInfo: BootInfo = await electron.getBootInfo();
            set({ 
                config: bootInfo.config, 
                usageStats: bootInfo.usage, 
                apiKey: bootInfo.env?.API_KEY || '' 
            });
            logger.info("Config loaded from Electron (BootInfo)");
        } catch (e) {
            logger.error("Failed to load boot info", undefined, { error: e });
        }
    } else {
        // Fallback for web preview
        logger.warn("Electron API not found, using Web Preview mocks");
        
        // Mock Env
        const mockKey = (window as any).process?.env?.API_KEY || '';
        
        set({ 
            apiKey: mockKey, 
            usageStats: [
                {
                    id: createCorrelationId(),
                    timestamp: Date.now(),
                    model: ModelLane.FAST,
                    lane: "fast",
                    promptTokens: 100,
                    outputTokens: 50,
                    totalTokens: 150,
                    latencyMs: 120,
                    cost: 0.00015
                }
            ] 
        });
    }
  },

  addUsageRecord: (record) => {
    set(state => ({ usageStats: [...state.usageStats, record] }));
    const electron = (window as any).electron;
    if (electron) {
        // Use legacy mapping or new API if available
        if (electron.logEvent) {
             // Logs are handled by logger sink, but usage tracking might need explicit save?
             // For now we assume in-memory main process tracking is separate or logEvent covers it.
        }
    }
  },

  setApiKey: (key) => set({ apiKey: key })
}));
