/// <reference types="vite/client" />

interface ElectronAPI {
  blcuSelectFile?: () => Promise<string | null>;
  blcuReadFile?: (path: string) => Promise<Uint8Array<ArrayBuffer>>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
