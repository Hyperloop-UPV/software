/// <reference types="vite/client" />

interface ElectronAPI {
  switchView: (view: string, query?: Record<string, string>) => Promise<string>;
  // Present only inside the Electron shell; the folder picker in a plain
  // browser never yields a path, so recent sessions are Electron-only.
  selectFolder?: () => Promise<string | null>;
  listSessionFiles?: (
    dir: string,
  ) => Promise<{ folderName: string; entries: string[] }>;
  readSessionFile?: (dir: string, relativePath: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
