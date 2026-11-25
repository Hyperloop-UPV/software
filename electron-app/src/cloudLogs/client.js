/**
 * @module cloudLogs
 * @description HTTP client and network transfer operations for the Cloud Logs service.
 * Handles authentication, listing, tag autocomplete, and upload/download streams.
 */

import { createReadStream, createWriteStream, openAsBlob } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { readConfig } from "../config/configInstance.js";

const DEFAULT_BASE_URL = "https://cloud-logs.hyperloopupv.com/api/v1";
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GiB
const TAG_CACHE_TTL_MS = 60 * 1000; // 60 seconds

let tagCache = {
  timestamp: 0,
  tags: [],
  key: "",
};

/**
 * Clears the in-memory cache for tag suggestions.
 */
export function clearTagCache() {
  tagCache = {
    timestamp: 0,
    tags: [],
    key: "",
  };
}

/**
 * Merges an optional caller AbortSignal with a timeout signal (default 15,000 ms).
 * @param {AbortSignal} [callerSignal] - Optional caller-provided signal.
 * @param {number} [timeoutMs=15000] - Timeout duration in milliseconds.
 * @returns {AbortSignal} Merged abort signal that aborts when either the timeout fires or the caller aborts.
 */
function createTimeoutSignal(callerSignal, timeoutMs = 15000) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!callerSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([callerSignal, timeoutSignal]);
  }
  const controller = new AbortController();
  const onAbort = () =>
    controller.abort(callerSignal.reason || timeoutSignal.reason);
  if (callerSignal.aborted || timeoutSignal.aborted) {
    controller.abort(
      callerSignal.aborted ? callerSignal.reason : timeoutSignal.reason,
    );
    return controller.signal;
  }
  callerSignal.addEventListener("abort", onAbort, { once: true });
  timeoutSignal.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

/**
 * Normalizes the Cloud Logs API base URL (HTTP/HTTPS only, no trailing or duplicate path slashes).
 * @param {string} [raw] - The raw URL string to normalize.
 * @returns {string} The normalized base URL.
 * @throws {Error} If the URL is invalid or uses an unsupported protocol.
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
 * Resolves the Cloud Logs API base URL from environment, configuration, or default fallback.
 * Precedence: env var CLOUD_LOGS_API_URL > config file > DEFAULT_BASE_URL.
 * @returns {Promise<string>} The resolved and normalized API base URL.
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
 * Converts filesystem-safe date strings (e.g. YYYY-MM-DDTHH-mm-ss) to ISO 8601 UTC.
 * @param {string} [dateStr] - The raw date string to convert.
 * @returns {string | undefined} The formatted ISO 8601 string, or undefined if input is invalid.
 */
export function convertDateToIso(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const match = dateStr.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T_ ](\d{1,2})[-:](\d{1,2})[-:](\d{1,2})(?:\.\d+)?/,
  );
  if (match) {
    const [, y, m, d, h, min, s] = match;
    const pad = (v) => String(v).padStart(2, "0");
    return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}Z`;
  }
  // Assume UTC if timezone is omitted
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(dateStr)) {
    return dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`;
  }
  return dateStr;
}

/**
 * Constructs authentication headers (Bearer token, X-API-Key, and optional X-User).
 * @param {Object} [credentials] - Credentials object.
 * @param {string} [credentials.apiKey] - The API key / bearer token.
 * @param {string} [credentials.user] - Optional username.
 * @returns {Record<string, string>} Headers object for HTTP requests.
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
 * Redacts secrets (API keys, Bearer tokens, query parameters) from a string
 * to prevent leaking credentials in UI messages or logs.
 * @param {string} text - The input string to sanitize.
 * @param {string} [apiKey] - The active API key to specifically redact.
 * @returns {string} The sanitized text with sensitive tokens replaced.
 */
export function sanitizeMessage(text, apiKey) {
  if (typeof text !== "string") return String(text);
  let result = text;
  // Only redact keys >= 4 chars to prevent replacing trivial substrings
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
 * Redacts secrets from an Error message and stack trace, preserving error code and HTTP status.
 * @param {Error | unknown} err - The error object to sanitize.
 * @param {string} [apiKey] - The active API key to redact.
 * @returns {Error} A new sanitized Error instance.
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

/**
 * Extracts error details from an HTTP error response and throws a sanitized Error.
 * @param {Response} response - The Fetch Response object.
 * @param {Object} [credentials] - Credentials containing the apiKey to redact.
 * @param {string} [credentials.apiKey] - The API key.
 * @returns {Promise<never>}
 * @throws {Error} Sanitized error with HTTP status and detail message.
 */
export async function handleResponseError(response, credentials) {
  let raw = "";
  try {
    if (typeof response.text === "function") {
      raw = await response.text();
    } else if (typeof response.json === "function") {
      const parsed = await response.json();
      raw = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    }
  } catch {
    // If reading body fails, fall back to statusText
  }

  let detail = "";
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const data = JSON.parse(raw);
      if (typeof data?.detail === "string" && data.detail.trim().length > 0) {
        detail = data.detail;
      } else if (data?.detail != null) {
        detail = JSON.stringify(data.detail);
      } else if (
        typeof data?.message === "string" &&
        data.message.trim().length > 0
      ) {
        detail = data.message;
      } else if (
        typeof data?.error === "string" &&
        data.error.trim().length > 0
      ) {
        detail = data.error;
      } else if (data != null && typeof data === "object") {
        detail = JSON.stringify(data);
      }
    } catch {
      detail = raw
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);
    }
  }

  if (!detail) {
    detail = response.statusText || "";
  }

  const err = new Error(
    `Request failed with status ${response.status}: ${detail}`,
  );
  err.status = response.status;
  throw sanitizeError(err, credentials?.apiKey);
}

/**
 * Fetches paginated log records from the Cloud Logs API and normalizes schema fields for the UI.
 * @param {Object} [options] - Request options.
 * @param {Object} [options.credentials] - User credentials.
 * @param {string} [options.credentials.apiKey] - The API key.
 * @param {string} [options.credentials.user] - The username.
 * @param {string} [options.cursor] - Pagination cursor or page number.
 * @returns {Promise<{items: Array<Object>, nextCursor?: string}>} Paginated log items and next cursor if available.
 * @throws {Error} If the request fails or returns an error status.
 */
export async function listLogs({ credentials, cursor, signal } = {}) {
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
      signal: createTimeoutSignal(signal),
    });

    if (!res.ok) {
      await handleResponseError(res, credentials);
    }

    const data = await res.json();
    const rawItems = Array.isArray(data?.items) ? data.items : [];
    // Normalize heterogeneous schema fields from different backend service versions
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
    const effectivePageSize = Number(data?.pageSize) || pageSize;
    if (page * effectivePageSize < total) {
      result.nextCursor = String(page + 1);
    }
    return result;
  } catch (err) {
    throw sanitizeError(err, credentials?.apiKey);
  }
}

/**
 * Retrieves tag suggestions from the Cloud Logs API, optionally filtered by a search query.
 * @param {Object} [options] - Request options.
 * @param {Object} [options.credentials] - User credentials.
 * @param {string} [options.credentials.apiKey] - The API key.
 * @param {string} [options.credentials.user] - The username.
 * @param {string} [options.query] - Optional query substring to filter tags.
 * @param {AbortSignal} [options.signal] - Optional caller AbortSignal.
 * @returns {Promise<string[]>} List of matching tag names.
 * @throws {Error} If the request fails.
 */
export async function autocompleteTags({ credentials, query, signal } = {}) {
  try {
    const baseUrl = await getBaseUrl();
    const cacheKey = `${baseUrl}:${credentials?.apiKey || ""}`;
    const now = Date.now();
    let allTags;

    if (
      tagCache.key === cacheKey &&
      now - tagCache.timestamp < TAG_CACHE_TTL_MS &&
      Array.isArray(tagCache.tags)
    ) {
      allTags = tagCache.tags;
    } else {
      const url = `${baseUrl}/logs/tags`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...getAuthHeaders(credentials),
          Accept: "application/json",
        },
        signal: createTimeoutSignal(signal),
      });

      if (!res.ok) {
        await handleResponseError(res, credentials);
      }

      const data = await res.json();
      allTags = Array.isArray(data) ? data : [];
      tagCache = {
        timestamp: now,
        tags: allTags,
        key: cacheKey,
      };
    }

    let tags = allTags;
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
 * Uploads a log archive directly to cloud storage using the initiate -> upload -> complete workflow.
 * @param {Object} [options] - Upload options.
 * @param {Object} [options.credentials] - User credentials.
 * @param {string} [options.credentials.apiKey] - The API key.
 * @param {string} [options.credentials.user] - The username.
 * @param {string} options.archivePath - Absolute path to the zip archive file.
 * @param {Object} [options.metadata] - Optional session metadata.
 * @param {string} [options.metadata.fileName] - Name of the archive file.
 * @param {string} [options.metadata.title] - Human-readable session title.
 * @param {string} [options.metadata.logDate] - Session date string.
 * @param {string} [options.metadata.date] - Alternate session date string.
 * @param {string} [options.metadata.user] - Owner username.
 * @param {string} [options.metadata.notes] - Notes or description.
 * @param {string[]} [options.metadata.tags] - Array of tags.
 * @returns {Promise<Object>} Upload summary containing session ID and metadata.
 * @throws {Error} If initiation, upload stream, or completion fails.
 */
export async function uploadLog({
  credentials,
  archivePath,
  metadata = {},
  signal,
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

    const note =
      typeof metadata.notes === "string" && metadata.notes.trim()
        ? metadata.notes.trim()
        : null;

    const tags = Array.isArray(metadata.tags)
      ? metadata.tags
          .filter((t) => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim())
      : [];

    const initiateBody = {
      fileName,
      fileSize,
      logDate,
      tags,
      note,
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
      signal: createTimeoutSignal(signal),
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
      // Stream binary directly to storage; omit auth headers to avoid credential leakage and signature errors
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
        duplex: "half", // Required by Fetch API for streaming request bodies
        signal,
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
        // Storage responses are not guaranteed to be JSON (e.g. empty 200 OK)
      }
    } catch (putErr) {
      await attemptAbort(baseUrl, sessionId, credentials, putErr.message);
      throw putErr;
    }

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
          signal: createTimeoutSignal(signal),
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

/**
 * Sends a best-effort abort request to the API server; suppresses errors to preserve the root cause.
 * @param {string} baseUrl - The API base URL.
 * @param {string} sessionId - The upload session identifier.
 * @param {Object} credentials - User credentials for authentication.
 * @param {string} [reason] - Abort reason description.
 * @returns {Promise<void>}
 */
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
      signal: createTimeoutSignal(undefined, 5000),
    });
  } catch {
    // Suppress abort failures to preserve the primary error
  }
}

/**
 * Downloads a log archive, streaming directly to disk while handling redirects and size limits.
 * @param {Object} [options] - Download options.
 * @param {Object} [options.credentials] - User credentials.
 * @param {string} [options.credentials.apiKey] - The API key.
 * @param {string} [options.credentials.user] - The username.
 * @param {string} options.id - The Cloud Log ID to download.
 * @param {string} options.destination - Absolute destination file path for the archive.
 * @param {number} [options.maxBytes] - Maximum allowed byte size (defaults to 4 GiB).
 * @param {AbortSignal} [options.signal] - Optional caller AbortSignal.
 * @returns {Promise<void>}
 * @throws {Error} If the download fails, redirect is invalid, or size limit is exceeded.
 */
export async function downloadLog({
  credentials,
  id,
  destination,
  maxBytes,
  signal,
} = {}) {
  const limit = typeof maxBytes === "number" ? maxBytes : DEFAULT_MAX_BYTES;
  const abortController = new AbortController();

  if (signal) {
    if (signal.aborted) {
      abortController.abort(signal.reason);
    } else {
      signal.addEventListener(
        "abort",
        () => abortController.abort(signal.reason),
        { once: true },
      );
    }
  }

  try {
    const baseUrl = await getBaseUrl();
    const downloadEndpoint = `${baseUrl}/logs/${encodeURIComponent(id)}/download`;

    const initialRes = await fetch(downloadEndpoint, {
      method: "GET",
      headers: getAuthHeaders(credentials),
      redirect: "manual",
      signal: abortController.signal,
    });

    let downloadRes;
    const status = initialRes.status;

    // Strip auth headers before redirect to external storage to prevent token leakage
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = initialRes.headers.get("location");
      if (!location) {
        throw new Error(
          `Redirect response (${status}) missing Location header`,
        );
      }
      const targetUrl = new URL(location, downloadEndpoint).href;
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

    let totalBytes = 0;
    const limitTransform = new Transform({
      transform(chunk, _encoding, callback) {
        const chunkLength = chunk.byteLength ?? chunk.length ?? 0;
        totalBytes += chunkLength;
        if (totalBytes > limit) {
          try {
            abortController.abort();
          } catch {
            // Ignore abort error
          }
          callback(
            new Error(
              `Download exceeded maximum allowed size of ${limit} bytes`,
            ),
          );
          return;
        }
        callback(null, chunk);
      },
    });

    const readable =
      typeof downloadRes.body.pipe === "function"
        ? downloadRes.body
        : Readable.fromWeb(downloadRes.body);

    const fileStream = createWriteStream(destination);

    await pipeline(readable, limitTransform, fileStream);
  } catch (err) {
    try {
      abortController.abort();
    } catch {
      // Ignore abort errors
    }
    try {
      await unlink(destination);
    } catch {
      // Best-effort cleanup
    }
    throw sanitizeError(err, credentials?.apiKey);
  }
}
