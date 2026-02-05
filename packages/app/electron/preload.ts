import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '@tradodesk/shared/src/types';
import { LogEventSchema, RequestActionSchema } from '@tradodesk/shared/src/schemas';

const API = {
  // 1. Boot Info
  getBootInfo: async () => {
    return ipcRenderer.invoke(IpcChannels.GET_BOOT_INFO);
  },

  // 2. Logging
  logEvent: (entry: any) => {
    const result = LogEventSchema.safeParse(entry);
    if (result.success) {
      ipcRenderer.send(IpcChannels.LOG_ENTRY, result.data);
    } else {
      console.error("[Preload] Invalid log entry blocked:", result.error);
    }
  },

  // 3. Generic Action Handler (Restricted)
  requestAction: async (action: any) => {
    const result = RequestActionSchema.safeParse(action);
    if (!result.success) {
      console.error("[Preload] Invalid action blocked:", result.error);
      throw new Error("Invalid action payload");
    }
    return ipcRenderer.invoke(IpcChannels.REQUEST_ACTION, result.data);
  },

  // 4. Listeners
  onAppError: (callback: (error: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(IpcChannels.ON_APP_ERROR, subscription);
    return () => ipcRenderer.removeListener(IpcChannels.ON_APP_ERROR, subscription);
  },

  onScreenshot: (callback: (base64: string) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(IpcChannels.BROKER_SCREENSHOT, subscription);
    return () => ipcRenderer.removeListener(IpcChannels.BROKER_SCREENSHOT, subscription);
  },

  // Legacy/Helper mappings to support existing code while migrating
  getConfig: () => ipcRenderer.invoke(IpcChannels.GET_CONFIG),
  saveConfig: (c: any) => ipcRenderer.invoke(IpcChannels.SAVE_CONFIG, c),
  getUsage: () => ipcRenderer.invoke(IpcChannels.GET_USAGE),
  runAutomation: (t: any) => ipcRenderer.invoke(IpcChannels.AUTOMATION_RUN, t),
  getEnv: () => ipcRenderer.invoke(IpcChannels.GET_BOOT_INFO).then((r: any) => r.env),
};

contextBridge.exposeInMainWorld('electron', API);
