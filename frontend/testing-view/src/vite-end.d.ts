/// <reference types="vite/client" />

import type { ConfigData } from "./types/ConfigData";

interface ElectronAPI {
  saveConfig: (config: ConfigData) => Promise<void>;
  getConfig: () => Promise<ConfigData>;
  importConfig: () => Promise<void>;
  selectFolder: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
