/** Shared desktop contract. HTTP and filesystem implementations live in Electron. */
export interface CloudLog {
  id: string;
  user: string;
  notes: string;
  tags: string[];
  date: string;
  title?: string;
  fileName?: string;
  logDate?: string;
  uploadDate?: string;
}

export interface LocalLogSession {
  id: string;
  name: string;
  launch: string;
  date: string;
  fileCount: number;
  bytes: number;
}

export interface DownloadedLog {
  id: string;
  path: string;
  date: string;
  title?: string;
  fileName?: string;
}

export interface CloudCredentialsStatus {
  user: string;
  hasApiKey: boolean;
  persistent: boolean;
}

export interface CloudLogProgress {
  requestId: string;
  phase: "compressing" | "uploading" | "downloading" | "extracting";
  completed?: number;
  total?: number;
}

export interface CloudLogsAPI {
  getCredentialsStatus(): Promise<CloudCredentialsStatus>;
  setCredentials(input: {
    user: string;
    apiKey?: string;
  }): Promise<CloudCredentialsStatus>;
  clearCredentials(): Promise<CloudCredentialsStatus>;
  getLocalSessions(): Promise<LocalLogSession[]>;
  selectSession(): Promise<LocalLogSession | null>;
  list(
    cursor?: string | null,
  ): Promise<{ items: CloudLog[]; nextCursor?: string }>;
  autocompleteTags(query: string): Promise<string[]>;
  upload(input: {
    sessionId: string;
    title?: string;
    notes: string;
    tags: string[];
    requestId: string;
  }): Promise<CloudLog>;
  download(input: {
    id: string;
    title?: string;
    fileName?: string;
    requestId: string;
  }): Promise<DownloadedLog>;
  getDownloads(): Promise<DownloadedLog[]>;
  onProgress(callback: (progress: CloudLogProgress) => void): () => void;
}
