import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadableStream } from "node:stream/web";

const mockConfig = vi.hoisted(() => ({ value: {} }));
vi.mock("../../config/configInstance.js", () => ({
  readConfig: vi.fn(async () => mockConfig.value),
}));

import {
  autocompleteTags,
  convertDateToIso,
  downloadLog,
  getAuthHeaders,
  getBaseUrl,
  handleResponseError,
  listLogs,
  normalizeApiUrl,
  sanitizeError,
  sanitizeMessage,
  uploadLog,
} from "../client.js";

describe("Cloud Logs Client", () => {
  let tempDir;
  let originalFetch;
  let originalEnvUrl;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "cloud-logs-client-test-"));
    mockConfig.value = {};
    originalEnvUrl = process.env.CLOUD_LOGS_API_URL;
    delete process.env.CLOUD_LOGS_API_URL;
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    if (originalEnvUrl !== undefined) {
      process.env.CLOUD_LOGS_API_URL = originalEnvUrl;
    } else {
      delete process.env.CLOUD_LOGS_API_URL;
    }
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Base URL & Auth Headers", () => {
    it("falls back to default base URL when not configured", async () => {
      const url = await getBaseUrl();
      expect(url).toBe("https://cloud-logs.hyperloopupv.com/api/v1");
    });

    it("uses config cloud_logs.api_url and normalizes cleanly", async () => {
      mockConfig.value = {
        cloud_logs: { api_url: "https://custom.logs.org/api/v1" },
      };
      expect(await getBaseUrl()).toBe("https://custom.logs.org/api/v1");

      mockConfig.value = {
        cloud_logs: { api_url: "https://custom.logs.org/api/v1/" },
      };
      expect(await getBaseUrl()).toBe("https://custom.logs.org/api/v1");

      mockConfig.value = { cloud_logs: { api_url: "https://custom.logs.org" } };
      expect(await getBaseUrl()).toBe("https://custom.logs.org");
    });

    it("prefers process.env.CLOUD_LOGS_API_URL over config and normalizes", async () => {
      mockConfig.value = {
        cloud_logs: { api_url: "https://custom.logs.org/api/v1" },
      };
      process.env.CLOUD_LOGS_API_URL = "http://localhost:8000";
      expect(await getBaseUrl()).toBe("http://localhost:8000");

      process.env.CLOUD_LOGS_API_URL = "http://localhost:8000/api/v1/";
      expect(await getBaseUrl()).toBe("http://localhost:8000/api/v1");
    });

    it("falls back to default base URL when empty, undefined, or null", () => {
      expect(normalizeApiUrl()).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1",
      );
      expect(normalizeApiUrl(undefined)).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1",
      );
      expect(normalizeApiUrl(null)).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1",
      );
      expect(normalizeApiUrl("")).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1",
      );
      expect(normalizeApiUrl("   ")).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1",
      );
    });

    it("preserves /api/v1, /api/v2, and custom paths without mangling them", () => {
      expect(normalizeApiUrl("https://example.com/api/v1")).toBe(
        "https://example.com/api/v1",
      );
      expect(normalizeApiUrl("https://example.com/api/v2")).toBe(
        "https://example.com/api/v2",
      );
      expect(normalizeApiUrl("http://localhost:8000")).toBe(
        "http://localhost:8000",
      );
      expect(normalizeApiUrl("https://example.com/proxy/subpath")).toBe(
        "https://example.com/proxy/subpath",
      );
    });

    it("removes trailing slashes and collapses multiple slashes", () => {
      expect(normalizeApiUrl("https://example.com/")).toBe(
        "https://example.com",
      );
      expect(normalizeApiUrl("https://example.com/api/v1/")).toBe(
        "https://example.com/api/v1",
      );
      expect(normalizeApiUrl("https://example.com/api/v2///")).toBe(
        "https://example.com/api/v2",
      );
      expect(normalizeApiUrl("https://example.com///proxy///subpath///")).toBe(
        "https://example.com/proxy/subpath",
      );
      expect(normalizeApiUrl("http://localhost:8000//api//v1//")).toBe(
        "http://localhost:8000/api/v1",
      );
    });

    it("throws on non-http/https protocols", () => {
      expect(() => normalizeApiUrl("ftp://foo.bar")).toThrow(
        'Invalid Cloud Logs API URL protocol: "ftp:". Only http: and https: are allowed.',
      );
      expect(() => normalizeApiUrl("ws://localhost:8080")).toThrow(
        'Invalid Cloud Logs API URL protocol: "ws:". Only http: and https: are allowed.',
      );
      expect(() => normalizeApiUrl("file:///path/to/api")).toThrow(
        'Invalid Cloud Logs API URL protocol: "file:". Only http: and https: are allowed.',
      );
    });

    it("throws on malformed strings", () => {
      expect(() => normalizeApiUrl("not-a-url")).toThrow(
        'Invalid Cloud Logs API URL: "not-a-url". Must be a valid absolute HTTP or HTTPS URL.',
      );
      expect(() => normalizeApiUrl("://invalid")).toThrow(
        'Invalid Cloud Logs API URL: "://invalid". Must be a valid absolute HTTP or HTTPS URL.',
      );
    });

    it("throws on non-string inputs", () => {
      expect(() => normalizeApiUrl(123)).toThrow(
        "Invalid Cloud Logs API URL: Expected string but received number",
      );
      expect(() => normalizeApiUrl({})).toThrow(
        "Invalid Cloud Logs API URL: Expected string but received object",
      );
    });

    it("builds auth headers correctly with apiKey and optional user", () => {
      expect(getAuthHeaders()).toEqual({});
      expect(getAuthHeaders({ apiKey: "secret123" })).toEqual({
        Authorization: "Bearer secret123",
        "X-API-Key": "secret123",
      });
      expect(
        getAuthHeaders({ apiKey: "secret123", user: "operator_john" }),
      ).toEqual({
        Authorization: "Bearer secret123",
        "X-API-Key": "secret123",
        "X-User": "operator_john",
      });
    });
  });

  describe("Date conversion", () => {
    it("converts YYYY-MM-DDTHH-mm-ss to ISO 8601 YYYY-MM-DDTHH:mm:ssZ", () => {
      expect(convertDateToIso("2026-11-15T12-30-00")).toBe(
        "2026-11-15T12:30:00Z",
      );
      expect(convertDateToIso("2026-01-01T00-00-00")).toBe(
        "2026-01-01T00:00:00Z",
      );
    });

    it("handles already ISO-formatted dates", () => {
      expect(convertDateToIso("2026-11-15T12:30:00Z")).toBe(
        "2026-11-15T12:30:00Z",
      );
      expect(convertDateToIso("2026-11-15T12:30:00")).toBe(
        "2026-11-15T12:30:00Z",
      );
    });

    it("converts single-digit date strings by padding with leading zeroes", () => {
      expect(convertDateToIso("2026-2-12T17-01-46")).toBe(
        "2026-02-12T17:01:46Z",
      );
      expect(convertDateToIso("2026-2-5 9:8:7")).toBe("2026-02-05T09:08:07Z");
    });

    it("returns undefined for missing or empty input", () => {
      expect(convertDateToIso(undefined)).toBeUndefined();
      expect(convertDateToIso("")).toBeUndefined();
    });
  });

  describe("Error sanitization", () => {
    it("sanitizes API keys and tokens from strings", () => {
      const apiKey = "super-secret-key-999";
      const dirty = `Error connecting with key ${apiKey} and header Bearer abc123def456`;
      const clean = sanitizeMessage(dirty, apiKey);
      expect(clean).not.toContain(apiKey);
      expect(clean).toContain("[REDACTED]");
      expect(clean).toContain("Bearer [REDACTED]");
    });

    it("sanitizes Error instances preserving status and code", () => {
      const apiKey = "key_xyz_789";
      const err = new Error(`Failed with API key ${apiKey}`);
      err.status = 401;
      err.code = "ERR_AUTH";
      const cleanErr = sanitizeError(err, apiKey);
      expect(cleanErr.message).not.toContain(apiKey);
      expect(cleanErr.message).toContain("[REDACTED]");
      expect(cleanErr.status).toBe(401);
      expect(cleanErr.code).toBe("ERR_AUTH");
    });

    it("sanitizes query parameters containing tokens", () => {
      const msg =
        "GET /api/v1/download?token=secretToken123&apiKey=anotherSecret";
      const clean = sanitizeMessage(msg);
      expect(clean).not.toContain("secretToken123");
      expect(clean).not.toContain("anotherSecret");
      expect(clean).toContain("?token=[REDACTED]");
      expect(clean).toContain("&apiKey=[REDACTED]");
    });

    it("avoids replacing short API keys under 4 characters to protect normal words", () => {
      const shortKey = "cat";
      const msg = "The catalog category indicates concat was successful";
      const clean = sanitizeMessage(msg, shortKey);
      expect(clean).toBe(msg);
    });

    it("sanitizes headers, JSON fields, and various query parameters", () => {
      const jsonPayload =
        '{"x-api-key": "secret-json-123", "apiKey": "json-key-456", "note": "ok"}';
      const cleanJson = sanitizeMessage(jsonPayload);
      expect(cleanJson).toContain('"x-api-key": "[REDACTED]"');
      expect(cleanJson).toContain('"apiKey": "[REDACTED]"');
      expect(cleanJson).not.toContain("secret-json-123");
      expect(cleanJson).not.toContain("json-key-456");

      const headerText = "api-key: my-secret-val; Bearer my-token-val;";
      const cleanHeader = sanitizeMessage(headerText);
      expect(cleanHeader).toBe("api-key: [REDACTED]; Bearer [REDACTED];");

      const queryUrl =
        "https://example.com/api?token=t1&api_key=k1&key=k2&secret=s1";
      const cleanQuery = sanitizeMessage(queryUrl);
      expect(cleanQuery).toBe(
        "https://example.com/api?token=[REDACTED]&api_key=[REDACTED]&key=[REDACTED]&secret=[REDACTED]",
      );
    });
  });

  describe("handleResponseError", () => {
    it("properly formats 422 validation error arrays without producing [object Object]", async () => {
      const validationErrors = [
        {
          loc: ["body", "logDate"],
          msg: "field required",
          type: "value_error.missing",
        },
        {
          loc: ["body", "fileSize"],
          msg: "ensure this value is greater than 0",
          type: "value_error.number.not_gt",
        },
      ];
      const mockResponse = {
        status: 422,
        json: async () => ({ detail: validationErrors }),
      };

      await expect(handleResponseError(mockResponse)).rejects.toThrow(
        `Request failed with status 422: ${JSON.stringify(validationErrors)}`,
      );

      try {
        await handleResponseError(mockResponse);
      } catch (err) {
        expect(err.message).not.toContain("[object Object]");
        expect(err.message).toContain("field required");
        expect(err.message).toContain("value_error.missing");
        expect(err.status).toBe(422);
      }
    });

    it("formats object detail without producing [object Object]", async () => {
      const errorObj = { error: "Unprocessable", code: 42201 };
      const mockResponse = {
        status: 422,
        json: async () => ({ detail: errorObj }),
      };

      try {
        await handleResponseError(mockResponse);
      } catch (err) {
        expect(err.message).not.toContain("[object Object]");
        expect(err.message).toContain(JSON.stringify(errorObj));
      }
    });

    it("uses string detail when detail is a string", async () => {
      const mockResponse = {
        status: 400,
        json: async () => ({ detail: "Invalid request payload" }),
      };

      try {
        await handleResponseError(mockResponse);
      } catch (err) {
        expect(err.message).toContain("Invalid request payload");
      }
    });

    it("falls back to message or JSON string when detail is absent", async () => {
      const mockResponseMsg = {
        status: 500,
        json: async () => ({ message: "Internal server error" }),
      };

      try {
        await handleResponseError(mockResponseMsg);
      } catch (err) {
        expect(err.message).toContain("Internal server error");
      }

      const mockResponseJson = {
        status: 500,
        json: async () => ({ code: "UNKNOWN_ERR" }),
      };

      try {
        await handleResponseError(mockResponseJson);
      } catch (err) {
        expect(err.message).toContain('{"code":"UNKNOWN_ERR"}');
      }
    });
  });

  describe("listLogs", () => {
    it("calls GET /logs with pagination parameters and auth headers", async () => {
      const mockItems = [
        {
          id: "uuid-1",
          fileName: "run_1.zip",
          creator: "alice",
          note: "Run 1 notes",
          tags: ["pod", "test"],
          logDate: "2026-10-23T10:00:00Z",
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 105,
          page: 1,
          pageSize: 50,
          items: mockItems,
        }),
      });
      globalThis.fetch = fetchMock;

      const result = await listLogs({
        credentials: { apiKey: "key-123", user: "alice" },
        cursor: "1",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1/logs?page=1&pageSize=50&sortBy=uploadDate&sortOrder=desc",
      );
      expect(options.method).toBe("GET");
      expect(options.headers).toMatchObject({
        Authorization: "Bearer key-123",
        "X-API-Key": "key-123",
        "X-User": "alice",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: "uuid-1",
        user: "alice",
        notes: "Run 1 notes",
        tags: ["pod", "test"],
        date: "2026-10-23T10:00:00Z",
        logDate: "2026-10-23T10:00:00Z",
        uploadDate: "",
        fileName: "run_1.zip",
        title: "run_1",
      });
      expect(result.nextCursor).toBe("2");
    });

    it("normalizes various backend field shapes (description, notes, creator, clientUser)", async () => {
      const mockItems = [
        {
          id: "uuid-2",
          clientMetadata: { clientUser: "bob" },
          description: "Description mapped to notes",
          tags: ["sensors"],
          uploadDate: "2026-11-01T08:00:00Z",
        },
        {
          id: "uuid-3",
          user: "carol",
          notes: "Already notes",
          tags: null,
          date: "2026-11-02T09:00:00",
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 2,
          page: 1,
          pageSize: 50,
          items: mockItems,
        }),
      });

      const result = await listLogs({ credentials: { apiKey: "key-123" } });
      expect(result.items).toEqual([
        {
          id: "uuid-2",
          user: "bob",
          notes: "Description mapped to notes",
          tags: ["sensors"],
          date: "2026-11-01T08:00:00Z",
          logDate: "",
          uploadDate: "2026-11-01T08:00:00Z",
          fileName: "",
          title: "",
        },
        {
          id: "uuid-3",
          user: "carol",
          notes: "Already notes",
          tags: [],
          date: "2026-11-02T09:00:00",
          logDate: "2026-11-02T09:00:00",
          uploadDate: "",
          fileName: "",
          title: "",
        },
      ]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("maps title and fileName following priority: item.title > clientMetadata.title > fileName without .zip", async () => {
      const mockItems = [
        {
          id: "item-1",
          title: "Explicit Title",
          clientMetadata: { title: "Ignored Meta" },
          fileName: "file_1.zip",
        },
        {
          id: "item-2",
          clientMetadata: { title: "Metadata Title" },
          fileName: "file_2.zip",
        },
        {
          id: "item-3",
          fileName: "run_recording_42.zip",
        },
        {
          id: "item-4",
          file_name: "fallback_snake_case.zip",
        },
        {
          id: "item-5",
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 5,
          items: mockItems,
        }),
      });

      const result = await listLogs({ credentials: { apiKey: "key-123" } });
      expect(result.items).toHaveLength(5);
      expect(result.items[0].title).toBe("Explicit Title");
      expect(result.items[0].fileName).toBe("file_1.zip");
      expect(result.items[1].title).toBe("Metadata Title");
      expect(result.items[1].fileName).toBe("file_2.zip");
      expect(result.items[2].title).toBe("run_recording_42");
      expect(result.items[2].fileName).toBe("run_recording_42.zip");
      expect(result.items[3].title).toBe("fallback_snake_case");
      expect(result.items[3].fileName).toBe("fallback_snake_case.zip");
      expect(result.items[4].title).toBe("");
      expect(result.items[4].fileName).toBe("");
    });

    it("throws sanitized error when list request fails", async () => {
      const apiKey = "secret-leak-key";
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: `Invalid credentials: ${apiKey}` }),
      });

      await expect(listLogs({ credentials: { apiKey } })).rejects.toThrow();
      try {
        await listLogs({ credentials: { apiKey } });
      } catch (err) {
        expect(err.message).not.toContain(apiKey);
        expect(err.message).toContain("[REDACTED]");
      }
    });
  });

  describe("autocompleteTags", () => {
    it("calls GET /logs/tags and returns all tags when query is absent", async () => {
      const tags = ["bms", "inverter", "motor", "pod", "propulsion"];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tags,
      });

      const result = await autocompleteTags({
        credentials: { apiKey: "key-1" },
      });
      expect(result).toEqual(tags);
    });

    it("filters tags case-insensitively when query is provided", async () => {
      const tags = ["BMS", "Brakes", "Inverter", "Motor", "Pod", "Propulsion"];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => tags,
      });

      const result = await autocompleteTags({
        credentials: { apiKey: "key-1" },
        query: "pr",
      });
      expect(result).toEqual(["Propulsion"]);

      const resultP = await autocompleteTags({
        credentials: { apiKey: "key-1" },
        query: "p",
      });
      expect(resultP).toEqual(["Pod", "Propulsion"]);

      const resultUpper = await autocompleteTags({
        credentials: { apiKey: "key-1" },
        query: "BRAK",
      });
      expect(resultUpper).toEqual(["Brakes"]);
    });

    it("sanitizes error if autocomplete tags request fails", async () => {
      const apiKey = "secret-tag-key";
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => `Database error occurred with key ${apiKey}`,
      });

      try {
        await autocompleteTags({ credentials: { apiKey } });
        expect.unreachable();
      } catch (err) {
        expect(err.message).not.toContain(apiKey);
        expect(err.message).toContain("[REDACTED]");
      }
    });
  });

  describe("uploadLog", () => {
    let archiveFile;

    beforeEach(async () => {
      archiveFile = path.join(tempDir, "session.zip");
      await writeFile(archiveFile, Buffer.from("dummy zip data"));
    });

    it("executes two-phase upload: initiate -> PUT stream -> complete", async () => {
      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/initiate")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-1",
              uploadUrl:
                "https://www.googleapis.com/upload/drive/v3/files?upload_id=abc",
              driveFolder: "2026_11",
              status: "pending_upload",
            }),
          };
        }
        if (url.startsWith("https://www.googleapis.com/upload")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: "drive-file-id-456" }),
          };
        }
        if (url.endsWith("/logs/session-uuid-1/complete")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-1",
              status: "ready",
              driveUrl:
                "https://drive.google.com/file/d/drive-file-id-456/view",
              fileName: "session.zip",
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const metadata = {
        user: "operator_manel",
        notes: "Track run test",
        tags: ["pod", "speed"],
        date: "2026-11-15T12-30-00",
      };

      const result = await uploadLog({
        credentials: { apiKey: "upload-key", user: "operator_manel" },
        archivePath: archiveFile,
        metadata,
      });

      expect(calls).toHaveLength(3);

      // 1. Initiate call
      const [initiateCall, putCall, completeCall] = calls;
      expect(initiateCall.url).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1/logs/initiate",
      );
      expect(initiateCall.options.headers).toMatchObject({
        Authorization: "Bearer upload-key",
        "X-API-Key": "upload-key",
        "X-User": "operator_manel",
      });
      const initiateBody = JSON.parse(initiateCall.options.body);
      expect(initiateBody).toEqual({
        fileName: "session.zip",
        fileSize: 14,
        logDate: "2026-11-15T12:30:00Z",
        tags: ["pod", "speed"],
        note: "Track run test",
        user: "operator_manel",
        clientMetadata: {
          clientUser: "operator_manel",
        },
      });

      // 2. PUT to uploadUrl: MUST NOT leak Authorization or X-API-Key headers
      expect(putCall.url).toContain(
        "https://www.googleapis.com/upload/drive/v3/files",
      );
      expect(putCall.options.method).toBe("PUT");
      expect(putCall.options.headers.Authorization).toBeUndefined();
      expect(putCall.options.headers["X-API-Key"]).toBeUndefined();
      expect(putCall.options.headers["X-User"]).toBeUndefined();

      // 3. Complete call
      expect(completeCall.url).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1/logs/session-uuid-1/complete",
      );
      expect(completeCall.options.headers).toMatchObject({
        Authorization: "Bearer upload-key",
        "X-API-Key": "upload-key",
      });
      expect(JSON.parse(completeCall.options.body)).toEqual({
        driveFileId: "drive-file-id-456",
      });

      // Return value: confirmed CloudLog
      expect(result).toEqual({
        id: "session-uuid-1",
        user: "operator_manel",
        notes: "Track run test",
        tags: ["pod", "speed"],
        date: "2026-11-15T12-30-00",
        fileName: "session.zip",
        title: undefined,
      });
    });

    it("respects metadata.fileName if provided, otherwise falling back to path.basename(archivePath)", async () => {
      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/initiate")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-custom-name",
              uploadUrl:
                "https://www.googleapis.com/upload/drive/v3/files?upload_id=name123",
              status: "pending_upload",
            }),
          };
        }
        if (url.startsWith("https://www.googleapis.com/upload")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: "drive-custom-name" }),
          };
        }
        if (url.endsWith("/complete")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-custom-name",
              status: "ready",
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      await uploadLog({
        credentials: { apiKey: "upload-key", user: "operator_manel" },
        archivePath: archiveFile,
        metadata: {
          fileName: "2026-02-12T17-01-46.zip",
          date: "2026-2-12T17-01-46",
        },
      });

      const initiateCall = calls.find((c) => c.url.endsWith("/logs/initiate"));
      expect(initiateCall).toBeDefined();
      const initiateBody = JSON.parse(initiateCall.options.body);
      expect(initiateBody.fileName).toBe("2026-02-12T17-01-46.zip");
      expect(initiateBody.logDate).toBe("2026-02-12T17:01:46Z");
    });

    it("uses metadata.logDate when provided with precedence over metadata.date", async () => {
      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/initiate")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-logdate",
              uploadUrl:
                "https://www.googleapis.com/upload/drive/v3/files?upload_id=logdate123",
              status: "pending_upload",
            }),
          };
        }
        if (url.startsWith("https://www.googleapis.com/upload")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: "drive-logdate" }),
          };
        }
        if (url.endsWith("/complete")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-logdate",
              status: "ready",
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      await uploadLog({
        credentials: { apiKey: "upload-key", user: "operator_manel" },
        archivePath: archiveFile,
        metadata: {
          logDate: "2026-11-20T10:00:00Z",
          date: "2026-11-19T09:00:00Z",
        },
      });

      const initiateCall = calls.find((c) => c.url.endsWith("/logs/initiate"));
      expect(initiateCall).toBeDefined();
      const initiateBody = JSON.parse(initiateCall.options.body);
      expect(initiateBody.logDate).toBe("2026-11-20T10:00:00Z");
    });

    it("aborts upload via POST /logs/{id}/abort if PUT to uploadUrl fails", async () => {
      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/initiate")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-abort",
              uploadUrl: "https://storage.googleapis.com/resumable-upload",
              status: "pending_upload",
            }),
          };
        }
        if (url.startsWith("https://storage.googleapis.com")) {
          return {
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            text: async () => "Google storage connection refused",
          };
        }
        if (url.endsWith("/logs/session-uuid-abort/abort")) {
          return {
            ok: true,
            json: async () => ({ id: "session-uuid-abort", status: "aborted" }),
          };
        }
        return { ok: false, status: 404 };
      });

      const apiKey = "abort-test-key";
      await expect(
        uploadLog({
          credentials: { apiKey, user: "operator_test" },
          archivePath: archiveFile,
          metadata: { notes: "test", tags: [] },
        }),
      ).rejects.toThrow();

      // Verify abort was called
      const abortCall = calls.find((c) =>
        c.url.endsWith("/logs/session-uuid-abort/abort"),
      );
      expect(abortCall).toBeDefined();
      expect(abortCall.options.method).toBe("POST");
      expect(abortCall.options.headers).toMatchObject({
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      });
      const abortBody = JSON.parse(abortCall.options.body);
      expect(abortBody.reason).toMatch(/failed with status 503/i);
    });

    it("aborts upload via POST /logs/{id}/abort if complete request fails", async () => {
      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/initiate")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-complete-fail",
              uploadUrl: "https://storage.googleapis.com/resumable-upload",
              status: "pending_upload",
            }),
          };
        }
        if (url.startsWith("https://storage.googleapis.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: "drive-file-999" }),
          };
        }
        if (url.endsWith("/complete")) {
          return {
            ok: false,
            status: 400,
            json: async () => ({
              detail: "File verification failed in Google Drive",
            }),
          };
        }
        if (url.endsWith("/abort")) {
          return {
            ok: true,
            json: async () => ({ status: "aborted" }),
          };
        }
        return { ok: false, status: 404 };
      });

      await expect(
        uploadLog({
          credentials: { apiKey: "key-123" },
          archivePath: archiveFile,
          metadata: { notes: "test", tags: [] },
        }),
      ).rejects.toThrow(/File verification failed/);

      const abortCall = calls.find((c) => c.url.endsWith("/abort"));
      expect(abortCall).toBeDefined();
    });

    it("returns credentials.user if metadata.user is omitted", async () => {
      globalThis.fetch = vi.fn(async (url) => {
        if (url.endsWith("/logs/initiate")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-no-user",
              uploadUrl:
                "https://www.googleapis.com/upload/drive/v3/files?upload_id=user1",
              status: "pending_upload",
            }),
          };
        }
        if (url.startsWith("https://www.googleapis.com/upload")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: "drive-file-id-user1" }),
          };
        }
        if (url.endsWith("/complete")) {
          return {
            ok: true,
            json: async () => ({ id: "session-uuid-no-user", status: "ready" }),
          };
        }
        return { ok: false, status: 404 };
      });

      const metadata = {
        notes: "Omitted user metadata",
        tags: ["test"],
        date: "2026-11-15T12-30-00",
      };

      const result = await uploadLog({
        credentials: { apiKey: "upload-key", user: "cred_operator_user" },
        archivePath: archiveFile,
        metadata,
      });

      expect(result.user).toBe("cred_operator_user");
      expect(result).toEqual({
        id: "session-uuid-no-user",
        user: "cred_operator_user",
        notes: "Omitted user metadata",
        tags: ["test"],
        date: "2026-11-15T12-30-00",
        fileName: "session.zip",
        title: undefined,
      });
    });

    it("includes title inside clientMetadata when metadata.title is provided, and returns fileName and title in confirmed log", async () => {
      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/initiate")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-title-1",
              uploadUrl:
                "https://www.googleapis.com/upload/drive/v3/files?upload_id=title1",
              status: "pending_upload",
            }),
          };
        }
        if (url.startsWith("https://www.googleapis.com/upload")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: "drive-file-id-title1" }),
          };
        }
        if (url.endsWith("/complete")) {
          return {
            ok: true,
            json: async () => ({
              id: "session-uuid-title-1",
              status: "ready",
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const metadata = {
        title: "BMS Track Run",
        fileName: "BMS Track Run.zip",
        user: "operator_manel",
        notes: "Run notes",
        tags: ["bms"],
        date: "2026-11-15T12-30-00",
      };

      const result = await uploadLog({
        credentials: { apiKey: "upload-key", user: "operator_manel" },
        archivePath: archiveFile,
        metadata,
      });

      const initiateCall = calls.find((c) => c.url.endsWith("/logs/initiate"));
      expect(initiateCall).toBeDefined();
      const initiateBody = JSON.parse(initiateCall.options.body);

      expect(initiateBody.clientMetadata).toEqual({
        clientUser: "operator_manel",
        title: "BMS Track Run",
      });
      expect(initiateBody.fileName).toBe("BMS Track Run.zip");

      expect(result).toEqual({
        id: "session-uuid-title-1",
        user: "operator_manel",
        notes: "Run notes",
        tags: ["bms"],
        date: "2026-11-15T12-30-00",
        fileName: "BMS Track Run.zip",
        title: "BMS Track Run",
      });
    });
  });

  describe("downloadLog", () => {
    it("handles 307 temporary redirect, strips auth headers, and streams to file", async () => {
      const destination = path.join(tempDir, "downloaded.zip");
      const fakeBinaryContent = Buffer.from(
        "ZIP FILE BYTES CONTENT 1234567890",
      );

      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/log-123/download")) {
          return {
            status: 307,
            headers: new Headers({
              location:
                "https://drive.google.com/uc?export=download&id=abc1234",
            }),
          };
        }
        if (url.startsWith("https://drive.google.com")) {
          return {
            ok: true,
            status: 200,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(fakeBinaryContent.subarray(0, 10));
                controller.enqueue(fakeBinaryContent.subarray(10));
                controller.close();
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const apiKey = "download-secret-key";
      await downloadLog({
        credentials: { apiKey, user: "user-1" },
        id: "log-123",
        destination,
      });

      expect(calls).toHaveLength(2);

      // Call 1: trusted API with auth headers and redirect: 'manual'
      const [initialCall, redirectCall] = calls;
      expect(initialCall.url).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1/logs/log-123/download",
      );
      expect(initialCall.options.redirect).toBe("manual");
      expect(initialCall.options.headers).toMatchObject({
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
        "X-User": "user-1",
      });

      // Call 2: Google Drive redirect target WITHOUT auth headers
      expect(redirectCall.url).toBe(
        "https://drive.google.com/uc?export=download&id=abc1234",
      );
      expect(redirectCall.options.headers).toBeUndefined();

      // Verify file written and closed
      const written = await readFile(destination);
      expect(written).toEqual(fakeBinaryContent);
    });

    it("handles direct 200 response and streams to destination", async () => {
      const destination = path.join(tempDir, "direct.zip");
      const content = Buffer.from("Direct 200 stream payload");

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(content);
            controller.close();
          },
        }),
      });

      await downloadLog({
        credentials: { apiKey: "key-1" },
        id: "log-direct",
        destination,
      });

      const written = await readFile(destination);
      expect(written).toEqual(content);
    });

    it("enforces maxBytes limit: aborts stream, unlinks destination, and throws error", async () => {
      const destination = path.join(tempDir, "oversized.zip");
      const chunk1 = Buffer.alloc(500, "a");
      const chunk2 = Buffer.alloc(600, "b");

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(chunk1);
            controller.enqueue(chunk2);
            controller.close();
          },
        }),
      });

      await expect(
        downloadLog({
          credentials: { apiKey: "key-1" },
          id: "log-oversized",
          destination,
          maxBytes: 800, // smaller than 500 + 600 = 1100
        }),
      ).rejects.toThrow(/Download exceeded maximum allowed size/);

      // Verify file was unlinked and does not exist
      await expect(stat(destination)).rejects.toThrow();
    });

    it("sanitizes error if download response returns error with API key", async () => {
      const destination = path.join(tempDir, "error.zip");
      const apiKey = "download-fail-key";

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        json: async () => ({ detail: `Log not found for apiKey ${apiKey}` }),
      });

      try {
        await downloadLog({
          credentials: { apiKey },
          id: "log-missing",
          destination,
        });
        expect.unreachable();
      } catch (err) {
        expect(err.message).not.toContain(apiKey);
        expect(err.message).toContain("[REDACTED]");
      }
    });

    it("handles relative redirect paths using new URL(location, downloadEndpoint)", async () => {
      const destination = path.join(tempDir, "relative-redirect.zip");
      const fakeBinaryContent = Buffer.from("RELATIVE REDIRECT STREAM CONTENT");

      const calls = [];
      globalThis.fetch = vi.fn(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/logs/log-rel-1/download")) {
          return {
            status: 302,
            headers: new Headers({
              location: "/storage/archives/log-rel-1.zip",
            }),
          };
        }
        if (
          url ===
          "https://cloud-logs.hyperloopupv.com/storage/archives/log-rel-1.zip"
        ) {
          return {
            ok: true,
            status: 200,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(fakeBinaryContent);
                controller.close();
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      await downloadLog({
        credentials: { apiKey: "key-1", user: "rel_user" },
        id: "log-rel-1",
        destination,
      });

      expect(calls).toHaveLength(2);
      const [initialCall, redirectCall] = calls;
      expect(initialCall.url).toBe(
        "https://cloud-logs.hyperloopupv.com/api/v1/logs/log-rel-1/download",
      );
      // Resolved target URL must match the expected URL resolved against downloadEndpoint
      expect(redirectCall.url).toBe(
        "https://cloud-logs.hyperloopupv.com/storage/archives/log-rel-1.zip",
      );
      expect(redirectCall.options.headers).toBeUndefined();

      const written = await readFile(destination);
      expect(written).toEqual(fakeBinaryContent);
    });
  });
});
