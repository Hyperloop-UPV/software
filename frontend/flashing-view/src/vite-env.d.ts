/// <reference types="vite/client" />

interface ElectronAPI {
  blcuSelectFile?: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
