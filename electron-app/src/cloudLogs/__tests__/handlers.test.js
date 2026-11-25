import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { handlers, mockIpcMain } = vi.hoisted(() => {
  const map = new Map();
  return {
    handlers: map,
    mockIpcMain: {
      handle: vi.fn((channel, fn) => {
        map.set(channel, fn);
      }),
    },
  };
});

vi.mock("electron", () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  ipcMain: mockIpcMain,
}));

vi.mock("../../utils/paths.js", () => ({
  getAppPath: () => "/app",
  getBackendWorkingDir: () => "/app",
}));

vi.mock("../credentials.js", () => ({
  getCredentials: vi
    .fn()
    .mockResolvedValue({ user: "testuser", apiKey: "secret-key-123" }),
  getCredentialsStatus: vi
    .fn()
    .mockResolvedValue({ user: "testuser", hasApiKey: true, persistent: true }),
  setCredentials: vi.fn(),
  clearCredentials: vi.fn(),
}));

vi.mock("../client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listLogs: vi.fn(),
    autocompleteTags: vi.fn(),
    uploadLog: vi.fn(),
    downloadLog: vi.fn(),
  };
});

vi.mock("../archive.js", () => ({
  compressSession: vi.fn(),
  extractSession: vi.fn(),
}));

vi.mock("../sessions.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    findLocalSessions: vi.fn(),
    formatSessionZipName: vi.fn((date, title) => {
      if (typeof title === "string" && title.trim()) {
        return `${title.trim()}.zip`;
      }
      return date ? `${date}.zip` : "2026-01-01T00-00-00.zip";
    }),
    getCloudRoot: vi.fn(),
    getLogsRoot: vi.fn().mockResolvedValue("/app/logger"),
    inspectSession: vi.fn(),
  };
});

import { dialog } from "electron";
import * as archive from "../archive.js";
import * as sessions from "../sessions.js";
import * as client from "../client.js";
import { setupCloudLogsHandlers } from "../handlers.js";

describe("Cloud Logs IPC handlers", () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    setupCloudLogsHandlers();
  });

  const createEvent = () => {
    const mainFrame = {
      url: "file:///app/renderer/logging-view/index.html",
    };
    return {
      sender: {
        id: 1,
        mainFrame,
        isDestroyed: () => false,
        send: vi.fn(),
      },
      senderFrame: mainFrame,
    };
  };

  describe("assertSender validation", () => {
    it("rejects calls from unauthorized URLs or views", async () => {
      const listHandler = handlers.get("cloud-logs:list");
      const evilEvent = {
        sender: {
          id: 2,
          mainFrame: { url: "file:///other-app/index.html" },
          isDestroyed: () => false,
        },
        senderFrame: { url: "file:///other-app/index.html" },
      };
      await expect(listHandler(evilEvent)).rejects.toThrow(
        "Cloud Logs is only available to local Logging and Testing views.",
      );
    });

    it("rejects calls from child frames even with allowed URL", async () => {
      const listHandler = handlers.get("cloud-logs:list");
      const mainFrame = { url: "file:///app/renderer/logging-view/index.html" };
      const childFrame = {
        url: "file:///app/renderer/logging-view/index.html",
      };
      const iframeEvent = {
        sender: { id: 1, mainFrame, isDestroyed: () => false },
        senderFrame: childFrame,
      };
      await expect(listHandler(iframeEvent)).rejects.toThrow(
        "Cloud Logs is only available to local Logging and Testing views.",
      );
    });
  });

  describe("list handler", () => {
    it("handles undefined, null, empty, and whitespace cursors gracefully", async () => {
      const listHandler = handlers.get("cloud-logs:list");
      expect(listHandler).toBeDefined();

      client.listLogs.mockResolvedValueOnce({ items: [], nextCursor: "2" });
      const resUndef = await listHandler(createEvent(), undefined);
      expect(client.listLogs).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        cursor: undefined,
      });
      expect(resUndef).toEqual({ items: [], nextCursor: "2" });

      client.listLogs.mockResolvedValueOnce({ items: [] });
      await listHandler(createEvent(), null);
      expect(client.listLogs).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        cursor: undefined,
      });

      client.listLogs.mockResolvedValueOnce({ items: [] });
      await listHandler(createEvent(), "");
      expect(client.listLogs).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        cursor: undefined,
      });

      client.listLogs.mockResolvedValueOnce({ items: [] });
      await listHandler(createEvent(), "   ");
      expect(client.listLogs).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        cursor: undefined,
      });
    });

    it("passes valid trimmed cursor string to client", async () => {
      const listHandler = handlers.get("cloud-logs:list");
      client.listLogs.mockResolvedValueOnce({ items: [] });

      await listHandler(createEvent(), "page-2");
      expect(client.listLogs).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        cursor: "page-2",
      });

      client.listLogs.mockResolvedValueOnce({ items: [] });
      await listHandler(createEvent(), "  cursor-token-42  ");
      expect(client.listLogs).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        cursor: "cursor-token-42",
      });
    });

    it("rejects non-string cursor types", async () => {
      const listHandler = handlers.get("cloud-logs:list");
      await expect(listHandler(createEvent(), 123)).rejects.toThrow(
        "Invalid Cloud Logs request.",
      );
      await expect(listHandler(createEvent(), {})).rejects.toThrow(
        "Invalid Cloud Logs request.",
      );
    });

    it("cleans and redacts error messages from client", async () => {
      const listHandler = handlers.get("cloud-logs:list");
      client.listLogs.mockRejectedValueOnce(
        new Error(
          "Request failed with Bearer secret-token-xyz and x-api-key: master-key-999",
        ),
      );

      await expect(listHandler(createEvent(), undefined)).rejects.toThrow(
        "Request failed with Bearer [REDACTED] and x-api-key: [REDACTED]",
      );
    });
  });

  describe("tags handler", () => {
    it("handles tag queries and sanitizes errors", async () => {
      const tagsHandler = handlers.get("cloud-logs:tags");
      expect(tagsHandler).toBeDefined();

      client.autocompleteTags.mockResolvedValueOnce(["bms", "motor"]);
      const tags = await tagsHandler(createEvent(), "bm");
      expect(tags).toEqual(["bms", "motor"]);
      expect(client.autocompleteTags).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        query: "bm",
      });

      client.autocompleteTags.mockRejectedValueOnce(
        new Error("API failure: Authorization: Bearer secret-token-123"),
      );
      await expect(tagsHandler(createEvent(), "pod")).rejects.toThrow(
        "API failure: Authorization: Bearer [REDACTED]",
      );
    });

    it("rejects invalid queries", async () => {
      const tagsHandler = handlers.get("cloud-logs:tags");
      await expect(tagsHandler(createEvent(), 123)).rejects.toThrow(
        "Invalid tag query.",
      );
      await expect(tagsHandler(createEvent(), "a".repeat(201))).rejects.toThrow(
        "Invalid tag query.",
      );
    });
  });

  describe("upload handler", () => {
    it("compresses and forwards upload metadata to client.uploadLog", async () => {
      const uploadHandler = handlers.get("cloud-logs:upload");
      const selectHandler = handlers.get("cloud-logs:select-session");
      expect(uploadHandler).toBeDefined();
      expect(selectHandler).toBeDefined();

      const event = createEvent();
      dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/app/logger/2026-11-15T12-00-00/2026-11-15T12-30-00"],
      });

      sessions.inspectSession.mockResolvedValueOnce({
        name: "2026-11-15T12-30-00",
        launch: "2026-11-15T12-00-00",
        date: "2026-11-15T12-30-00",
        bytes: 100,
        fileCount: 2,
        files: [],
      });

      archive.compressSession.mockResolvedValueOnce({
        name: "2026-11-15T12-30-00",
        date: "2026-11-15T12-30-00",
      });

      client.uploadLog.mockResolvedValueOnce({
        id: "upload-1",
        user: "testuser",
        notes: "Test notes",
        tags: ["pod"],
        date: "2026-11-15T12-30-00",
      });

      const selected = await selectHandler(event);
      expect(selected).toBeDefined();

      const result = await uploadHandler(event, {
        sessionId: selected.id,
        notes: "Test notes",
        tags: ["pod"],
        requestId: "req-upload-1",
      });

      expect(client.uploadLog).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        archivePath: expect.stringContaining("2026-11-15T12-30-00.zip"),
        metadata: {
          fileName: "2026-11-15T12-30-00.zip",
          title: undefined,
          user: "testuser",
          notes: "Test notes",
          tags: ["pod"],
          date: "2026-11-15T12-30-00",
        },
      });
      expect(result).toEqual({
        id: "upload-1",
        user: "testuser",
        notes: "Test notes",
        tags: ["pod"],
        date: "2026-11-15T12-30-00",
      });
    });

    it("extracts custom title and passes archiveName and title to client.uploadLog", async () => {
      const uploadHandler = handlers.get("cloud-logs:upload");
      const selectHandler = handlers.get("cloud-logs:select-session");

      const event = createEvent();
      dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/app/logger/2026-11-15T12-00-00/2026-11-15T12-30-00"],
      });

      sessions.inspectSession.mockResolvedValueOnce({
        name: "2026-11-15T12-30-00",
        launch: "2026-11-15T12-00-00",
        date: "2026-11-15T12-30-00",
        bytes: 100,
        fileCount: 2,
        files: [],
      });

      archive.compressSession.mockResolvedValueOnce({
        name: "2026-11-15T12-30-00",
        date: "2026-11-15T12-30-00",
      });

      client.uploadLog.mockResolvedValueOnce({
        id: "upload-title-1",
        user: "testuser",
        notes: "Notes with title",
        tags: ["run"],
        date: "2026-11-15T12-30-00",
        fileName: "High Speed Run.zip",
        title: "High Speed Run",
      });

      const selected = await selectHandler(event);
      expect(selected).toBeDefined();

      const result = await uploadHandler(event, {
        sessionId: selected.id,
        title: "High Speed Run",
        notes: "Notes with title",
        tags: ["run"],
        requestId: "req-upload-title-1",
      });

      expect(sessions.formatSessionZipName).toHaveBeenCalledWith(
        "2026-11-15T12-30-00",
        "High Speed Run",
      );
      expect(client.uploadLog).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        archivePath: expect.stringContaining("High Speed Run.zip"),
        metadata: {
          fileName: "High Speed Run.zip",
          title: "High Speed Run",
          user: "testuser",
          notes: "Notes with title",
          tags: ["run"],
          date: "2026-11-15T12-30-00",
        },
      });
      expect(result).toEqual({
        id: "upload-title-1",
        user: "testuser",
        notes: "Notes with title",
        tags: ["run"],
        date: "2026-11-15T12-30-00",
        fileName: "High Speed Run.zip",
        title: "High Speed Run",
      });
    });

    it("rejects upload when title exceeds 200 characters", async () => {
      const uploadHandler = handlers.get("cloud-logs:upload");
      const selectHandler = handlers.get("cloud-logs:select-session");

      const event = createEvent();
      dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/app/logger/2026-11-15T12-00-00/2026-11-15T12-30-00"],
      });

      sessions.inspectSession.mockResolvedValueOnce({
        name: "2026-11-15T12-30-00",
        launch: "2026-11-15T12-00-00",
        date: "2026-11-15T12-30-00",
        bytes: 100,
        fileCount: 2,
        files: [],
      });

      const selected = await selectHandler(event);

      await expect(
        uploadHandler(event, {
          sessionId: selected.id,
          title: "a".repeat(201),
          notes: "Notes",
          tags: [],
          requestId: "req-upload-too-long",
        }),
      ).rejects.toThrow("Invalid Cloud Logs request.");
    });

    it("allows upload with empty title without throwing Invalid Cloud Logs request", async () => {
      const uploadHandler = handlers.get("cloud-logs:upload");
      const selectHandler = handlers.get("cloud-logs:select-session");

      const event = createEvent();
      dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/app/logger/2026-11-15T12-00-00/2026-11-15T12-30-00"],
      });

      sessions.inspectSession.mockResolvedValueOnce({
        name: "2026-11-15T12-30-00",
        launch: "2026-11-15T12-00-00",
        date: "2026-11-15T12-30-00",
        bytes: 100,
        fileCount: 2,
        files: [],
      });

      archive.compressSession.mockResolvedValueOnce({
        name: "2026-11-15T12-30-00",
        date: "2026-11-15T12-30-00",
      });

      client.uploadLog.mockResolvedValueOnce({
        id: "upload-empty-title",
        user: "testuser",
        notes: "Notes with empty title",
        tags: [],
        date: "2026-11-15T12-30-00",
        fileName: "2026-11-15T12-30-00.zip",
        title: undefined,
      });

      const selected = await selectHandler(event);

      const result = await uploadHandler(event, {
        sessionId: selected.id,
        title: "",
        notes: "Notes with empty title",
        tags: [],
        requestId: "req-upload-empty-title",
      });

      expect(sessions.formatSessionZipName).toHaveBeenCalledWith(
        "2026-11-15T12-30-00",
        "",
      );
      expect(client.uploadLog).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        archivePath: expect.stringContaining("2026-11-15T12-30-00.zip"),
        metadata: {
          fileName: "2026-11-15T12-30-00.zip",
          title: undefined,
          user: "testuser",
          notes: "Notes with empty title",
          tags: [],
          date: "2026-11-15T12-30-00",
        },
      });
      expect(result.id).toBe("upload-empty-title");
    });
  });

  describe("download handler", () => {
    let testCloudRoot;

    beforeEach(async () => {
      testCloudRoot = await mkdtemp(path.join(tmpdir(), "cloud-logs-dl-test-"));
      sessions.getCloudRoot.mockResolvedValue(testCloudRoot);
      sessions.inspectSession.mockResolvedValue({
        date: "2026-11-15T12-30-00",
        fileCount: 3,
        bytes: 1024,
      });
      client.downloadLog.mockImplementation(async ({ destination }) => {
        await writeFile(destination, "mock zip content");
      });
      archive.extractSession.mockImplementation(async (_zip, dest) => {
        await mkdir(dest, { recursive: true });
        return { date: "2026-11-15T12-30-00" };
      });
    });

    afterEach(async () => {
      await rm(testCloudRoot, { recursive: true, force: true });
    });

    it("downloads and names archive using fileName when provided", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      const result = await downloadHandler(event, {
        id: "session-1",
        title: "Test Run Title",
        fileName: "custom-run-1.zip",
        requestId: "req-dl-1",
      });

      expect(client.downloadLog).toHaveBeenCalledWith({
        credentials: { user: "testuser", apiKey: "secret-key-123" },
        id: "session-1",
        destination: expect.stringMatching(/[/\\]custom-run-1\.zip$/),
        maxBytes: 4 * 1024 ** 3,
      });

      const expectedDir = path.join(testCloudRoot, "custom-run-1-12-30-00");
      expect(result).toEqual({
        id: "session-1",
        path: expectedDir,
        date: "2026-11-15T12-30-00",
        title: "Test Run Title",
        fileName: "custom-run-1.zip",
      });

      const savedInfo = JSON.parse(
        await readFile(path.join(expectedDir, "cloud-log.json"), "utf8"),
      );
      expect(savedInfo).toEqual({
        id: "session-1",
        date: "2026-11-15T12-30-00",
        title: "Test Run Title",
        fileName: "custom-run-1.zip",
      });
    });

    it("appends .zip to fileName if missing", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      const result = await downloadHandler(event, {
        id: "session-2",
        fileName: "session-no-ext",
        requestId: "req-dl-2",
      });

      expect(client.downloadLog).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.stringMatching(/[/\\]session-no-ext\.zip$/),
        }),
      );
      expect(result.title).toBe("session-no-ext");
      expect(result.fileName).toBe("session-no-ext");
    });

    it("derives archiveName from title with sanitized characters when fileName is omitted", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      const result = await downloadHandler(event, {
        id: "session-3",
        title: "Test/Run:1*Speed?2",
        requestId: "req-dl-3",
      });

      expect(client.downloadLog).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.stringMatching(/[/\\]Test_Run_1_Speed_2\.zip$/),
        }),
      );
      expect(result.title).toBe("Test/Run:1*Speed?2");
      expect(result.fileName).toBe("Test_Run_1_Speed_2.zip");
    });

    it("falls back to id.zip when neither fileName nor title is provided", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      const result = await downloadHandler(event, {
        id: "session-4",
        requestId: "req-dl-4",
      });

      expect(client.downloadLog).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.stringMatching(/[/\\]session-4\.zip$/),
        }),
      );
      expect(result.title).toBe("");
      expect(result.fileName).toBe("session-4.zip");
    });

    it("returns cached session data with title and fileName on cache hit", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      // First download
      await downloadHandler(event, {
        id: "session-cache",
        title: "Original Title",
        fileName: "cached-session.zip",
        requestId: "req-cache-1",
      });
      expect(client.downloadLog).toHaveBeenCalledTimes(1);

      // Second download with same id (cache hit)
      const cached = await downloadHandler(event, {
        id: "session-cache",
        requestId: "req-cache-2",
      });

      expect(client.downloadLog).toHaveBeenCalledTimes(1);
      expect(cached).toEqual({
        id: "session-cache",
        path: path.join(testCloudRoot, "cached-session-12-30-00"),
        date: "2026-11-15T12-30-00",
        title: "Original Title",
        fileName: "cached-session.zip",
      });
    });

    it("derives title from fileName on cache hit if info.title is missing", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();
      const id = "session-cache-no-title";
      const dir = path.join(testCloudRoot, "legacy-run-12-30-00");
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, "cloud-log.json"),
        JSON.stringify({
          id,
          date: "2026-11-15T12-30-00",
          fileName: "legacy-run.zip",
        }),
      );

      const cached = await downloadHandler(event, {
        id,
        requestId: "req-cache-3",
      });
      expect(client.downloadLog).not.toHaveBeenCalled();
      expect(cached.title).toBe("legacy-run");
      expect(cached.fileName).toBe("legacy-run.zip");
    });

    it("handles download with empty title and empty fileName without throwing", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      const result = await downloadHandler(event, {
        id: "session-empty-props",
        title: "",
        fileName: "",
        requestId: "req-dl-empty",
      });

      expect(client.downloadLog).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.stringMatching(/[/\\]session-empty-props\.zip$/),
        }),
      );
      expect(result.title).toBe("");
      expect(result.fileName).toBe("session-empty-props.zip");
    });

    it("sanitizes fileName with special characters and path subdirectories", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      const result = await downloadHandler(event, {
        id: "session-sanitize",
        fileName: "../../nested/bad:file*name?.zip",
        requestId: "req-dl-sanitize",
      });

      expect(client.downloadLog).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: expect.stringMatching(/[/\\]bad_file_name_\.zip$/),
        }),
      );
      expect(result.fileName).toBe("bad_file_name_.zip");
    });

    it("cleans up corrupt cache directory and redownloads when cloud-log.json is invalid", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();
      const id = "session-corrupt-cache";
      const dir = path.join(testCloudRoot, "corrupt-cache-dir");
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, "cloud-log.json"),
        `{"id":"${id}", invalid:`,
      );

      const result = await downloadHandler(event, {
        id,
        title: "Recovered Title",
        requestId: "req-dl-corrupt",
      });

      expect(client.downloadLog).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(id);
      expect(result.title).toBe("Recovered Title");
    });

    it("disambiguates destination folder name when destination exists for a different session", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      const existingDir = path.join(testCloudRoot, "custom-run-12-30-00");
      await mkdir(existingDir, { recursive: true });
      await writeFile(
        path.join(existingDir, "cloud-log.json"),
        JSON.stringify({
          id: "other-id",
          date: "2026-11-15T12-30-00",
          fileName: "custom-run.zip",
        }),
      );

      const result = await downloadHandler(event, {
        id: "new-id",
        fileName: "custom-run.zip",
        requestId: "req-dl-disambiguate",
      });

      const disambiguatedDir = path.join(
        testCloudRoot,
        "custom-run-12-30-00_2",
      );
      expect(result.path).toBe(disambiguatedDir);

      const existingContent = JSON.parse(
        await readFile(path.join(existingDir, "cloud-log.json"), "utf8"),
      );
      expect(existingContent.id).toBe("other-id");

      const newContent = JSON.parse(
        await readFile(path.join(disambiguatedDir, "cloud-log.json"), "utf8"),
      );
      expect(newContent.id).toBe("new-id");
    });

    it("rejects download with invalid id, title > 200, or fileName > 255", async () => {
      const downloadHandler = handlers.get("cloud-logs:download");
      const event = createEvent();

      await expect(
        downloadHandler(event, { id: "", requestId: "req-err-1" }),
      ).rejects.toThrow("Invalid Cloud Logs request.");

      await expect(
        downloadHandler(event, {
          id: "session-err",
          title: "a".repeat(201),
          requestId: "req-err-2",
        }),
      ).rejects.toThrow("Invalid Cloud Logs request.");

      await expect(
        downloadHandler(event, {
          id: "session-err",
          fileName: "a".repeat(256),
          requestId: "req-err-3",
        }),
      ).rejects.toThrow("Invalid Cloud Logs request.");
    });
  });

  describe("downloads handler", () => {
    let testCloudRoot;

    beforeEach(async () => {
      testCloudRoot = await mkdtemp(
        path.join(tmpdir(), "cloud-logs-dls-test-"),
      );
      sessions.getCloudRoot.mockResolvedValue(testCloudRoot);
    });

    afterEach(async () => {
      await rm(testCloudRoot, { recursive: true, force: true });
    });

    it("returns list of downloaded sessions including title and fileName sorted by date descending", async () => {
      const downloadsHandler = handlers.get("cloud-logs:downloads");
      expect(downloadsHandler).toBeDefined();

      const item1Id = "session-1";
      const item1Dir = path.join(testCloudRoot, "Run A - 12-00-00");
      await mkdir(item1Dir, { recursive: true });
      await writeFile(
        path.join(item1Dir, "cloud-log.json"),
        JSON.stringify({
          id: item1Id,
          date: "2026-11-15T12-00-00",
          title: "Run A",
          fileName: "run-a.zip",
        }),
      );

      const item2Id = "session-2";
      const item2Dir = path.join(testCloudRoot, "run-b - 14-00-00");
      await mkdir(item2Dir, { recursive: true });
      await writeFile(
        path.join(item2Dir, "cloud-log.json"),
        JSON.stringify({
          id: item2Id,
          date: "2026-11-15T14-00-00",
          fileName: "run-b.zip",
        }),
      );

      const item3Id = "session-3";
      const item3Dir = path.join(testCloudRoot, "session-3 - 10-00-00");
      await mkdir(item3Dir, { recursive: true });
      await writeFile(
        path.join(item3Dir, "cloud-log.json"),
        JSON.stringify({
          id: item3Id,
          date: "2026-11-15T10-00-00",
        }),
      );

      // Directory without cloud-log.json should be skipped
      const nonSessionDir = path.join(testCloudRoot, "unrelated-dir");
      await mkdir(nonSessionDir, { recursive: true });

      sessions.inspectSession.mockImplementation(async (dir) => {
        if (dir === item1Dir) return { date: "2026-11-15T12-00-00" };
        if (dir === item2Dir) return { date: "2026-11-15T14-00-00" };
        if (dir === item3Dir) return { date: "2026-11-15T10-00-00" };
        return { date: "2026-11-15T00-00-00" };
      });

      const list = await downloadsHandler(createEvent());

      expect(list).toHaveLength(3);
      expect(list[0]).toEqual({
        id: "session-2",
        date: "2026-11-15T14-00-00",
        path: item2Dir,
        title: "run-b",
        fileName: "run-b.zip",
      });
      expect(list[1]).toEqual({
        id: "session-1",
        date: "2026-11-15T12-00-00",
        path: item1Dir,
        title: "Run A",
        fileName: "run-a.zip",
      });
      expect(list[2]).toEqual({
        id: "session-3",
        date: "2026-11-15T10-00-00",
        path: item3Dir,
        title: "",
        fileName: "",
      });
    });
  });
});
