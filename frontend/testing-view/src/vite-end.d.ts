/// <reference types="vite/client" />

import type { CloudLogsAPI } from "@hyperloopupv/frontend-kit/core";
import type { ConfigData } from "./types/ConfigData";

interface ElectronAPI {
  cloudLogs?: CloudLogsAPI;
  saveConfig: (config: ConfigData) => Promise<void>;
  getConfig: () => Promise<ConfigData>;
  importConfig: () => Promise<void>;
  selectFolder: () => Promise<string>;
  openFolder: (path: string) => Promise<void>;
  restartBackend: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
