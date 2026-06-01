/// <reference types="vite/client" />

interface ElectronAPI {
  blcuSelectFile?: () => Promise<string | null>;
  blcuUpload?: (request: {
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
