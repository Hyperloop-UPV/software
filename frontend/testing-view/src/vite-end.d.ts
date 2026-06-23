/// <reference types="vite/client" />

import type { ConfigData } from "./types/ConfigData";

interface ElectronAPI {
  saveConfig: (config: ConfigData) => Promise<void>;
  getConfig: () => Promise<ConfigData>;
  importConfig: () => Promise<void>;
  selectFolder: () => Promise<string>;
  openFolder: (path: string) => Promise<void>;
  blcuSelectFile?: () => Promise<string | null>;
  blcuUpload?: (request: {
    host: string;
    port: number;
    remote_filename: string;
    local_path: string;
  }) => Promise<{ ok: boolean; message: string }>;
  blcuDownload?: (request: {
    host: string;
    port: number;
    remote_filename: string;
    local_path: string;
  }) => Promise<{ ok: boolean; message: string }>;
  blcuHealth?: () => Promise<{ status: string }>;
  blcuLogs?: (tail?: number) => Promise<{ lines: string[]; line_count: number }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
