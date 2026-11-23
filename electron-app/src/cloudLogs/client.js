import { createReadStream, createWriteStream, openAsBlob } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { readConfig } from "../config/configInstance.js";

const DEFAULT_BASE_URL = "https://cloud-logs.hyperloopupv.com/api/v1";
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GiB

/**
 * Normalizes an API base URL without trailing slashes.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeApiUrl(raw) {
  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim() === "")
  ) {
    return DEFAULT_BASE_URL;
  }
  if (typeof raw !== "string") {
    throw new Error(
      `Invalid Cloud Logs API URL: Expected string but received ${typeof raw}`,
    );
  }
  const trimmed = raw.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid Cloud Logs API URL: "${trimmed}". Must be a valid absolute HTTP or HTTPS URL.`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Invalid Cloud Logs API URL protocol: "${parsed.protocol}". Only http: and https: are allowed.`,
    );
  }
  const cleanPathname = parsed.pathname
    .replace(/\/+/g, "/")
    .replace(/\/+$/, "");
  return `${parsed.origin}${cleanPathname}`;
}

/**
 * Resolves the Cloud Logs API base URL from env, config or default.
 * @returns {Promise<string>}
 */
export async function getBaseUrl() {
  let raw = process.env.CLOUD_LOGS_API_URL;
  if (!raw) {
    try {
      const config = await readConfig();
      raw = config?.cloud_logs?.api_url;
    } catch {
      // Ignore readConfig failures (e.g. missing files or test environments)
    }
  }
  return normalizeApiUrl(raw);
}

/**
 * Converts a logger date string (e.g. "YYYY-MM-DDTHH-mm-ss") to ISO 8601 "YYYY-MM-DDTHH:mm:ssZ".
 * @param {string|undefined} dateStr
 * @returns {string|undefined}
 */
export function convertDateToIso(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const match = dateStr.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T_ ](\d{1,2})[-:](\d{1,2})[-:](\d{1,2})(?:\.\d+)?/,
  );
  if (match) {
    const [, y, m, d, h, min, s] = match;
    const pad = (v) => v.padStart(2, "0");
    return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(dateStr)) {
    return dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`;
  }
  return dateStr;
}

/**
 * Returns auth headers for API requests. Never includes undefined or empty values.
 * @param {{apiKey?: string, user?: string}} [credentials]
 * @returns {Record<string, string>}
 */
export function getAuthHeaders(credentials) {
  const headers = {};
  if (credentials?.apiKey) {
    headers["Authorization"] = `Bearer ${credentials.apiKey}`;
    headers["X-API-Key"] = credentials.apiKey;
  }
  if (credentials?.user) {
    headers["X-User"] = credentials.user;
  }
  return headers;
}

/**
 * Sanitizes strings, error messages, and stacks to ensure no API keys or tokens leak.
 * @param {string} text
 * @param {string} [apiKey]
 * @returns {string}
 */
export function sanitizeMessage(text, apiKey) {
  if (typeof text !== "string") return String(text);
  let result = text;
  if (typeof apiKey === "string" && apiKey.trim().length >= 4) {
    result = result.replaceAll(apiKey, "[REDACTED]");
    if (apiKey.trim() !== apiKey) {
      result = result.replaceAll(apiKey.trim(), "[REDACTED]");
    }
  }
  result = result.replace(/Bearer\s+[^\s"'>;&]+/gi, "Bearer [REDACTED]");
  result = result.replace(
    /(["']?(?:x-)?api[_-]?key["']?\s*[:=]\s*["']?)[^\s"'>;&,]+/gi,
    "$1[REDACTED]",
  );
  result = result.replace(
    /([?&](?:token|api[_-]?key|key|secret)=)[^&\s"'>]+/gi,
    "$1[REDACTED]",
  );
  return result;
}

/**
 * Sanitizes an error to prevent leaking secrets.
 * @param {Error|any} err
 * @param {string} [apiKey]
 * @returns {Error}
 */
export function sanitizeError(err, apiKey) {
  if (!err) return new Error("Unknown error");
  const origMessage = err.message || String(err);
  const cleanMessage = sanitizeMessage(origMessage, apiKey);
  const sanitized = new Error(cleanMessage);
  if (err.code) sanitized.code = err.code;
  if (err.status) sanitized.status = err.status;
  if (err.stack) {
    sanitized.stack = sanitizeMessage(err.stack, apiKey);
  }
  return sanitized;
}

export async function handleResponseError(response, credentials) {
  let detail = "";
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") {
      detail = data.detail;
    } else if (data?.detail != null) {
      detail = JSON.stringify(data.detail);
    } else {
      detail = data?.message || JSON.stringify(data);
    }
  } catch {
    try {
      detail = await response.text();
    } catch {
      detail = response.statusText;
    }
  }
  const err = new Error(
    `Request failed with status ${response.status}: ${detail}`,
  );
  err.status = response.status;
  throw sanitizeError(err, credentials?.apiKey);
}

/**
 * @param {{credentials?: {apiKey?: string, user?: string}, cursor?: string}} params
 * @returns {Promise<{items: Array<{id:string,user:string,notes:string,tags:string[],date:string}>,nextCursor?:string}>}
 */
export async function listLogs({ credentials, cursor } = {}) {
  try {
    const baseUrl = await getBaseUrl();
    const page = Math.max(1, parseInt(cursor, 10) || 1);
    const pageSize = 50;
    const url = `${baseUrl}/logs?page=${page}&pageSize=${pageSize}&sortBy=uploadDate&sortOrder=desc`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...getAuthHeaders(credentials),
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      await handleResponseError(res, credentials);
    }

    const data = await res.json();
    const rawItems = Array.isArray(data?.items) ? data.items : [];
    const items = rawItems.map((item) => ({
      id: String(item.id),
      user: item.creator || item.user || item.clientMetadata?.clientUser || "",
      notes: item.note ?? item.notes ?? item.description ?? "",
      tags: Array.isArray(item.tags) ? item.tags : [],
      date:
        item.logDate ||
        item.uploadDate ||
        item.fileDate ||
        item.date ||
        item.createdAt ||
        "",
      logDate: item.logDate || item.fileDate || item.date || "",
      uploadDate: item.uploadDate || item.createdAt || "",
      fileName: item.fileName || item.file_name || "",
      title:
        item.title ||
        item.clientMetadata?.title ||
        (item.fileName
          ? item.fileName.replace(/\.zip$/i, "")
          : item.file_name
            ? item.file_name.replace(/\.zip$/i, "")
            : ""),
    }));

    const total =
      typeof data?.total === "number" ? data.total : rawItems.length;
    const result = { items };
    if (page * pageSize < total) {
      result.nextCursor = String(page + 1);
    }
    return result;
  } catch (err) {
    throw sanitizeError(err, credentials?.apiKey);
  }
}

/**
 * @param {{credentials?: {apiKey?: string, user?: string}, query?: string}} params
 * @returns {Promise<string[]>}
 */
export async function autocompleteTags({ credentials, query } = {}) {
  try {
    const baseUrl = await getBaseUrl();
    const url = `${baseUrl}/logs/tags`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...getAuthHeaders(credentials),
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      await handleResponseError(res, credentials);
    }

    const data = await res.json();
    let tags = Array.isArray(data) ? data : [];
    if (typeof query === "string" && query.trim()) {
      const q = query.trim().toLowerCase();
      tags = tags.filter(
        (t) => typeof t === "string" && t.toLowerCase().includes(q),
      );
    }
    return tags;
  } catch (err) {
    throw sanitizeError(err, credentials?.apiKey);
  }
}

/**
 * @param {{credentials?: {apiKey?: string, user?: string}, archivePath: string, metadata: {user?: string, notes?: string, tags?: string[], date?: string}}} params
 * @returns {Promise<{id:string,user:string,notes:string,tags:string[],date:string}>}
 */
export async function uploadLog({
  credentials,
  archivePath,
  metadata = {},
} = {}) {
  let sessionId = null;
  let baseUrl;
  try {
    baseUrl = await getBaseUrl();
    const stats = await stat(archivePath);
    const fileSize = stats.size;
    const fileName = metadata.fileName || path.basename(archivePath);
    const logDate = convertDateToIso(metadata.logDate || metadata.date);
    const user = metadata.user || credentials?.user;

    const clientMetadata = {
      clientUser: user,
    };
    if (metadata.title) {
      clientMetadata.title = metadata.title;
    }

    const initiateBody = {
      fileName,
      fileSize,
      logDate,
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      note: metadata.notes,
      user,
      clientMetadata,
    };

    const initiateRes = await fetch(`${baseUrl}/logs/initiate`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(credentials),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(initiateBody),
    });

    if (!initiateRes.ok) {
      await handleResponseError(initiateRes, credentials);
    }

    const session = await initiateRes.json();
    sessionId = session?.id;

    if (!session?.uploadUrl) {
      throw new Error(
        "Cloud Logs upload initiate response did not contain uploadUrl",
      );
    }

    let driveFileId;
    try {
      // Step 2: PUT binary stream of archivePath to uploadUrl
      // DO NOT send Authorization or X-API-Key headers to uploadUrl
      let body;
      if (typeof openAsBlob === "function") {
        body = await openAsBlob(archivePath);
      } else {
        body = Readable.toWeb(createReadStream(archivePath));
      }

      const putRes = await fetch(session.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/zip",
        },
        body,
        duplex: "half",
      });

      if (!putRes.ok) {
        let errDetail = "";
        try {
          errDetail = await putRes.text();
        } catch {
          errDetail = putRes.statusText;
        }
        throw new Error(
          `Upload to storage URL failed with status ${putRes.status}: ${errDetail}`,
        );
      }

      try {
        const putData = await putRes.json();
        if (putData?.id) {
          driveFileId = putData.id;
        }
      } catch {
        // Body may not be JSON
      }
    } catch (putErr) {
      await attemptAbort(baseUrl, sessionId, credentials, putErr.message);
      throw putErr;
    }

    // Step 3: POST to /logs/{id}/complete with JSON body { driveFileId }
    try {
      const completeBody = driveFileId ? { driveFileId } : {};
      const completeRes = await fetch(
        `${baseUrl}/logs/${encodeURIComponent(sessionId)}/complete`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(credentials),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(completeBody),
        },
      );

      if (!completeRes.ok) {
        await handleResponseError(completeRes, credentials);
      }
    } catch (completeErr) {
      await attemptAbort(baseUrl, sessionId, credentials, completeErr.message);
      throw completeErr;
    }

    return {
      id: String(session.id),
      user: user || metadata.user || "",
      notes: metadata.notes,
      tags: metadata.tags,
      date: metadata.date,
      fileName,
      title: metadata.title,
    };
  } catch (err) {
    throw sanitizeError(err, credentials?.apiKey);
  }
}

async function attemptAbort(baseUrl, sessionId, credentials, reason) {
  if (!sessionId || !baseUrl) return;
  try {
    await fetch(`${baseUrl}/logs/${encodeURIComponent(sessionId)}/abort`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: reason || "Upload failed" }),
    });
  } catch {
    // Suppress abort failures to preserve the primary error
  }
}

/**
 * @param {{credentials?: {apiKey?: string, user?: string}, id: string, destination: string, maxBytes?: number}} params
 * @returns {Promise<void>}
 */
export async function downloadLog({
  credentials,
  id,
  destination,
  maxBytes,
} = {}) {
  const limit = typeof maxBytes === "number" ? maxBytes : DEFAULT_MAX_BYTES;
  const abortController = new AbortController();
  let fileStream = null;

  try {
    const baseUrl = await getBaseUrl();
    const downloadEndpoint = `${baseUrl}/logs/${encodeURIComponent(id)}/download`;

    // Step 1: GET /logs/{id}/download with redirect: 'manual' and auth headers
    const initialRes = await fetch(downloadEndpoint, {
      method: "GET",
      headers: getAuthHeaders(credentials),
      redirect: "manual",
      signal: abortController.signal,
    });

    let downloadRes;
    const status = initialRes.status;

    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = initialRes.headers.get("location");
      if (!location) {
        throw new Error(
          `Redirect response (${status}) missing Location header`,
        );
      }
      const targetUrl = new URL(location, downloadEndpoint).href;
      // Step 2: Fetch download URL WITHOUT auth headers
      downloadRes = await fetch(targetUrl, {
        method: "GET",
        signal: abortController.signal,
      });

      if (!downloadRes.ok) {
        await handleResponseError(downloadRes, credentials);
      }
    } else if (status === 200) {
      downloadRes = initialRes;
    } else {
      await handleResponseError(initialRes, credentials);
    }

    if (!downloadRes.body) {
      throw new Error("Download response body is empty");
    }

    fileStream = createWriteStream(destination);
    fileStream.on("error", () => {}); // Avoid unhandled error crash

    let totalBytes = 0;
    let exceeded = false;

    for await (const chunk of downloadRes.body) {
      const chunkLength = chunk.byteLength ?? chunk.length ?? 0;
      totalBytes += chunkLength;
      if (totalBytes > limit) {
        exceeded = true;
        abortController.abort();
        break;
      }
      if (!fileStream.write(chunk)) {
        await new Promise((resolve, reject) => {
          fileStream.once("drain", resolve);
          fileStream.once("error", reject);
        });
      }
    }

    if (exceeded) {
      fileStream.destroy();
      await new Promise((resolve) => {
        if (fileStream.closed) return resolve();
        fileStream.once("close", resolve);
      });
      try {
        await unlink(destination);
      } catch {
        // Best-effort cleanup
      }
      throw new Error(
        `Download exceeded maximum allowed size of ${limit} bytes`,
      );
    }

    // Wait for write stream to close before resolving
    await new Promise((resolve, reject) => {
      if (fileStream.closed) return resolve();
      fileStream.on("error", reject);
      fileStream.on("close", resolve);
      fileStream.end();
    });
  } catch (err) {
    try {
      abortController.abort();
    } catch {
      // Ignore abort errors
    }
    if (fileStream) {
      fileStream.destroy();
      await new Promise((resolve) => {
        if (fileStream.closed) return resolve();
        fileStream.once("close", resolve);
      });
    }
    try {
      await unlink(destination);
    } catch {
      // Best-effort cleanup
    }
    throw sanitizeError(err, credentials?.apiKey);
  }
}
