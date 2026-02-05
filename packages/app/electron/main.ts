import { app, BrowserWindow, ipcMain, Tray, Menu, BrowserView, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { IpcChannels, AppConfig, UsageRecord, ErrorCode, BootInfo } from '@tradodesk/shared/src/types';
import { AutomationTaskSchema, UsageRecordSchema, toAppError } from '@tradodesk/shared/src/errorUtils';
import { LogEventSchema, RequestActionSchema } from '@tradodesk/shared/src/schemas';
import { Logger } from '@tradodesk/shared/src/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Logger Setup ---
const logger = new Logger("main");

// 1. Console Sink
logger.addSink((entry) => {
    console.log(`[MAIN:${entry.level.toUpperCase()}] ${entry.message} ${entry.data ? JSON.stringify(entry.data) : ''}`);
});

// 2. File Sink
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'main.log');

logger.addSink((entry) => {
    const line = `[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message} ${entry.correlationId ? `[${entry.correlationId}]` : ''} ${entry.data ? JSON.stringify(entry.data) : ''}\n`;
    fs.appendFile(LOG_FILE, line, (err) => {
        if (err) console.error("Failed to write to log file", err);
    });
});

logger.info(`Log file path: ${LOG_FILE}`);

// Config Defaults
let appConfig: AppConfig = {
  demoMode: true,
  secureMode: true,
  logLevel: 'info',
  rateLimitMs: 800,
  pricing: {
    'gemini-3-pro-preview': { input: 1.25, output: 5.00 },
    'gemini-2.5-flash-lite': { input: 0.075, output: 0.30 }
  }
};
let usageData: UsageRecord[] = [];

async function createWindow() {
  logger.info("Creating window...");
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  const win = new BrowserWindow({
    width: Math.floor(width * 0.9),
    height: Math.floor(height * 0.9),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true
    },
    backgroundColor: '#020617',
    show: false
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logger.fatal(`did-fail-load: ${errorCode} - ${errorDescription} (${validatedURL})`);
    win.loadURL(`data:text/html;charset=utf-8,<h1>Boot Failure</h1><p>${errorDescription}</p>`);
  });

  // Load Strategy
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    logger.info(`Loading Dev URL: ${devUrl}`);
    win.loadURL(devUrl).catch(e => logger.error("Failed to load Dev URL", undefined, { error: String(e) }));
    win.webContents.openDevTools();
  } else {
    const indexHtml = path.resolve(__dirname, '..', 'dist', 'index.html');
    logger.info(`Loading Production File: ${indexHtml}`);
    if (!fs.existsSync(indexHtml)) {
        logger.fatal(`Index file missing at ${indexHtml}`);
    } else {
        win.loadFile(indexHtml).catch(e => logger.error("Failed to load file", undefined, { error: String(e) }));
    }
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // Embedded Broker View
  const brokerView = new BrowserView({
    webPreferences: {
      partition: 'persist:broker_session',
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  win.setBrowserView(brokerView);
  brokerView.setBounds({ x: 0, y: 40, width: Math.floor(width * 0.5), height: height - 40 });
  brokerView.webContents.loadURL('https://google.com').catch(e => logger.warn("Broker view load failed", undefined, {err: String(e)}));

  win.on('resize', () => {
      const bounds = win.getBounds();
      brokerView.setBounds({ x: 0, y: 40, width: Math.floor(bounds.width * 0.5), height: bounds.height - 40 });
  });

  // Shortcuts
  win.webContents.on('before-input-event', async (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 's') {
      event.preventDefault();
      try {
        const image = await brokerView.webContents.capturePage();
        const base64 = image.toDataURL();
        win.webContents.send(IpcChannels.BROKER_SCREENSHOT, base64);
      } catch (e) {
        logger.error("Screenshot failed", undefined, { error: String(e) });
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

// 1. Boot Info
ipcMain.handle(IpcChannels.GET_BOOT_INFO, async (): Promise<BootInfo> => {
    return {
        config: appConfig,
        env: { API_KEY: process.env.API_KEY },
        usage: usageData
    };
});

// 2. Log Entry
ipcMain.on(IpcChannels.LOG_ENTRY, (_, rawEntry) => {
    const result = LogEventSchema.safeParse(rawEntry);
    if (result.success) {
        // Log to Main Logger (which writes to file)
        const entry = result.data;
        // Adjust source to clarify it came from IPC
        if (entry.source === 'renderer') logger.info(`[Renderer] ${entry.message}`, entry.correlationId, entry.data);
        else logger.info(`[IPC:${entry.source}] ${entry.message}`, entry.correlationId, entry.data);
    } else {
        logger.warn("Invalid log entry received via IPC", undefined, result.error);
    }
});

// 3. Request Action (Generic)
ipcMain.handle(IpcChannels.REQUEST_ACTION, async (_, rawAction) => {
    const result = RequestActionSchema.safeParse(rawAction);
    if (!result.success) return { ok: false, error: "Schema Validation Failed" };

    const { type, payload } = result.data;

    switch (type) {
        case 'GET_CONFIG': return appConfig;
        case 'SAVE_CONFIG': 
            appConfig = { ...appConfig, ...payload };
            return appConfig;
        case 'GET_USAGE': return usageData;
        case 'RUN_AUTOMATION':
             // Re-validate Automation Task
             const taskResult = AutomationTaskSchema.safeParse(payload);
             if (!taskResult.success) throw new Error("Invalid Automation Payload");
             // In real app, dispatch to worker
             logger.info(`[Automation] ${taskResult.data.action}`, undefined, taskResult.data);
             return { success: true, message: "Stub Executed" };
        default:
            return { ok: false, error: "Unknown Action Type" };
    }
});

// Legacy handlers for compatibility during migration (or if preload uses them)
ipcMain.handle(IpcChannels.GET_CONFIG, () => appConfig);
ipcMain.handle(IpcChannels.GET_USAGE, () => usageData);
ipcMain.handle(IpcChannels.AUTOMATION_RUN, async (_, task) => ({ success: true, message: "Legacy Stub" }));
