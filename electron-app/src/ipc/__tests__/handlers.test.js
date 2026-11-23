import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { handlers, mockIpcMain, mockWebContents } = vi.hoisted(() => {
  const map = new Map();
  const webContents = { id: 1 };
  return {
    handlers: map,
    mockIpcMain: {
      handle: vi.fn((channel, fn) => {
        map.set(channel, fn);
      }),
    },
    mockWebContents: webContents,
  };
});

vi.mock("electron", () => ({
  app: {
    getVersion: () => "1.0.0",
    emit: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn(),
  },
  ipcMain: mockIpcMain,
  shell: {
    openPath: vi.fn(),
  },
}));

vi.mock("../../utils/paths.js", () => ({
  getAppPath: () => "/app",
}));

vi.mock("../../utils/logger.js", () => ({
  logger: {
    electron: {
      info: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock("../../windows/mainWindow.js", () => ({
  getMainWindow: () => ({ webContents: mockWebContents }),
  getCurrentView: vi.fn(),
  loadView: vi.fn(),
}));

vi.mock("../../processes/backend.js", () => ({
  getBackendWorkingDir: () => "/app",
  restartBackend: vi.fn(),
}));

vi.mock("../../config/configInstance.js", () => ({
  importConfig: vi.fn(),
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
}));

vi.mock("../../cloudLogs/handlers.js", () => ({
  setupCloudLogsHandlers: vi.fn(),
}));

vi.mock("../../cloudLogs/sessions.js", () => ({
  getLogsRoot: vi.fn().mockResolvedValue("/app/logger"),
}));

import { setupIpcHandlers } from "../handlers.js";

describe("IPC handlers - list-session-files", () => {
  let tempDir;

  beforeEach(async () => {
    handlers.clear();
    vi.clearAllMocks();
    setupIpcHandlers();
    tempDir = await mkdtemp(path.join(tmpdir(), "ipc-session-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const createSenderEvent = () => ({
    sender: mockWebContents,
  });

  it("uses basename of directory when cloud-log.json is absent", async () => {
    const handler = handlers.get("list-session-files");
    expect(handler).toBeDefined();

    await writeFile(path.join(tempDir, "data.csv"), "1,2,3");

    const result = await handler(createSenderEvent(), tempDir);
    expect(result.folderName).toBe(path.basename(tempDir));
    expect(result.entries).toContain("data.csv");
  });

  it("uses info.title from cloud-log.json as folderName when present", async () => {
    const handler = handlers.get("list-session-files");

    await writeFile(
      path.join(tempDir, "cloud-log.json"),
      JSON.stringify({ title: "Custom Session Title", fileName: "custom.zip" }),
    );
    await writeFile(path.join(tempDir, "logger_settings.json"), "{}");

    const result = await handler(createSenderEvent(), tempDir);
    expect(result.folderName).toBe("Custom Session Title");
    expect(result.entries).toContain("logger_settings.json");
    expect(result.entries).not.toContain("cloud-log.json");
  });

  it("uses info.fileName without .zip from cloud-log.json when title is absent", async () => {
    const handler = handlers.get("list-session-files");

    await writeFile(
      path.join(tempDir, "cloud-log.json"),
      JSON.stringify({ fileName: "Run_2026-11-15.zip" }),
    );
    await writeFile(path.join(tempDir, "logger_settings.json"), "{}");

    const result = await handler(createSenderEvent(), tempDir);
    expect(result.folderName).toBe("Run_2026-11-15");
    expect(result.entries).toContain("logger_settings.json");
    expect(result.entries).not.toContain("cloud-log.json");
  });

  it("falls back to basename when cloud-log.json has neither title nor fileName", async () => {
    const handler = handlers.get("list-session-files");

    await writeFile(
      path.join(tempDir, "cloud-log.json"),
      JSON.stringify({ id: "session-123" }),
    );

    const result = await handler(createSenderEvent(), tempDir);
    expect(result.folderName).toBe(path.basename(tempDir));
  });
});
