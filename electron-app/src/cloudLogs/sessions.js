/**
 * @module cloudLogs
 * @description Session discovery, inspection, and path formatting utilities for Cloud Logs.
 * Handles locating local recording sessions, validating session contents, and resolving paths.
 */

import { lstat, readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "../config/configInstance.js";
import { getBackendWorkingDir } from "../utils/paths.js";

/**
 * Hard limit of 4 GiB per session archive to guard against memory and disk exhaustion.
 * @constant {number}
 */
export const MAX_BYTES = 4 * 1024 ** 3;

/**
 * Limit of 10,000 files per session to mitigate zip bomb attacks and inode exhaustion.
 * @constant {number}
 */
export const MAX_FILES = 10000;

/**
 * Determines whether a file path belongs to a regular session recording.
 * Excludes internal descriptor and traversal paths.
 * @param {string} name - Relative file name or path.
 * @returns {boolean} True if the file belongs to a session recording.
 */
export const isSessionFile = (name) =>
  name === "logger_settings.json" ||
  (!name.startsWith("cloud-log.json") && !name.startsWith("../"));

/**
 * Resolves the telemetry logs root directory (`<logging_path>/logger`).
 * @returns {Promise<string>} Absolute path to the logger directory.
 */
export async function getLogsRoot() {
  const config = await readConfig();
  return path.resolve(
    getBackendWorkingDir(),
    config.logging?.logging_path || ".",
    "logger",
  );
}

/**
 * Resolves `logger/cloud-logs`, rejecting symlinks to prevent directory traversal.
 * @returns {Promise<string>} Absolute path to the cloud-logs directory.
 * @throws {Error} If the cloud logs directory is a symbolic link.
 */
export async function getCloudRoot() {
  const root = path.join(await getLogsRoot(), "cloud-logs");
  await mkdir(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink())
    throw new Error("Cloud Logs folder cannot be a symbolic link.");
  return root;
}

/**
 * Formats upload ZIP filename from recording date and optional sanitized title.
 * @param {string} [dateStr] - ISO or formatted recording date string.
 * @param {string} [title] - Optional human-readable session title.
 * @returns {string} Sanitized ZIP filename ending in .zip.
 */
export function formatSessionZipName(dateStr, title) {
  if (typeof title === "string" && title.trim()) {
    const cleaned = title
      .trim()
      .replace(/\.zip$/i, "")
      .replace(/[/\\?%*:|"<>]/g, "_");
    if (cleaned) {
      return `${cleaned}.zip`;
    }
  }

  const pad = (v) => String(v).padStart(2, "0");
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = pad(now.getUTCMonth() + 1);
    const d = pad(now.getUTCDate());
    const h = pad(now.getUTCHours());
    const min = pad(now.getUTCMinutes());
    const s = pad(now.getUTCSeconds());
    return `${y}-${m}-${d}T${h}-${min}-${s}.zip`;
  }

  const match = dateStr.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T_ ](\d{1,2})[-:](\d{1,2})[-:](\d{1,2})/,
  );
  if (match) {
    const [, y, m, d, h, min, s] = match;
    return `${y}-${pad(m)}-${pad(d)}T${pad(h)}-${pad(min)}-${pad(s)}.zip`;
  }

  const cleaned = dateStr
    .trim()
    .replace(/\.zip$/i, "")
    .replace(/[/\\?%*:|"<>]/g, "-");
  return `${cleaned}.zip`;
}

/**
 * Formats destination directory name: `<sanitized title or filename>-<hh-mm-ss>`.
 * @param {string} [dateStr] - Optional recording date string containing time components.
 * @param {Object} [metadata={}] - Session metadata options.
 * @param {string} [metadata.fileName] - Original archive filename.
 * @param {string} [metadata.title] - Human-readable session title.
 * @param {string} [metadata.id] - Remote session identifier.
 * @returns {string} Formatted directory name.
 */
export function formatDownloadedFolderName(
  dateStr,
  { fileName, title, id } = {},
) {
  let base = "";
  if (typeof fileName === "string" && fileName.trim()) {
    base = path
      .basename(fileName.trim())
      .replace(/\.zip$/i, "")
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .trim();
  }
  if (!base && typeof title === "string" && title.trim()) {
    base = title
      .trim()
      .replace(/\.zip$/i, "")
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .trim();
  }
  if (!base && typeof id === "string" && id.trim()) {
    base = id
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .trim();
  }
  if (!base) {
    base = "session";
  }

  const pad = (v) => String(v).padStart(2, "0");
  let timePart = "";
  if (typeof dateStr === "string" && dateStr.trim()) {
    const match = dateStr.match(/[T_ ](\d{1,2})[-:](\d{1,2})[-:](\d{1,2})/);
    if (match) {
      const [, h, min, s] = match;
      timePart = `${pad(h)}-${pad(min)}-${pad(s)}`;
    }
  }

  if (!timePart) {
    const now = new Date();
    timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  }

  return `${base}-${timePart}`;
}

/**
 * Validates a recording directory and extracts session metadata from logger_settings.json.
 * Enforces depth limit, file count limit, byte size limit, and symlink prohibition.
 * @param {string} dir - Absolute path to the session folder to inspect.
 * @returns {Promise<{ name: string, launch: string, date: string, bytes: number, fileCount: number, files: Array<{ name: string, size: number, mtimeMs: number }> }>} Session metadata.
 * @throws {Error} If directory is invalid, limits are exceeded, or logger_settings.json is missing or malformed.
 */
export async function inspectSession(dir) {
  if (!(await lstat(dir)).isDirectory())
    throw new Error("Select a logging session folder.");
  const files = [];
  let bytes = 0;

  // Recursively traverse directory up to depth limit
  async function walk(relative = "", depth = 0) {
    if (depth > 8) throw new Error("Session directory is too deeply nested.");
    for (const entry of await readdir(path.join(dir, relative), {
      withFileTypes: true,
    })) {
      if (entry.isSymbolicLink())
        throw new Error("Session folders cannot contain symbolic links.");
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(name, depth + 1);
      } else if (entry.isFile() && name !== "cloud-log.json") {
        const stats = await lstat(path.join(dir, name));
        bytes += stats.size;
        files.push({ name, size: stats.size, mtimeMs: stats.mtimeMs });
        if (bytes > MAX_BYTES || files.length > MAX_FILES)
          throw new Error("Session exceeds the 4 GiB / 10,000 file limit.");
      }
    }
  }
  await walk();

  // Validate that logger_settings.json is present
  if (!files.some((f) => f.name === "logger_settings.json"))
    throw new Error(
      "Select a recording containing logger_settings.json, not the app launch folder.",
    );

  // Parse session date from logger_settings.json
  const settings = JSON.parse(
    await readFile(path.join(dir, "logger_settings.json"), "utf8"),
  );
  const dateMatch =
    typeof settings.date === "string" &&
    settings.date.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})[T_ ](\d{1,2})[-:](\d{1,2})[-:](\d{1,2})/,
    );
  if (!dateMatch) throw new Error("Session has no valid recording date.");
  const [, y, m, d, h, min, s] = dateMatch;
  const pad = (v) => v.padStart(2, "0");
  const normalizedDate = `${y}-${pad(m)}-${pad(d)}T${pad(h)}-${pad(min)}-${pad(s)}`;
  return {
    name: path.basename(dir),
    launch: path.basename(path.dirname(dir)),
    date: normalizedDate,
    bytes,
    fileCount: files.length,
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Discovers completed local sessions across launch directories, sorted descending by date.
 * @returns {Promise<Array<Object>>} List of discovered session metadata objects.
 * @throws {Error} If reading the root log directory fails.
 */
export async function findLocalSessions() {
  const root = await getLogsRoot();
  let launches;
  try {
    launches = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const sessions = [];
  for (const launch of launches) {
    if (!launch.isDirectory() || !/^\d{4}-\d{2}-\d{2}T/.test(launch.name))
      continue;
    for (const entry of await readdir(path.join(root, launch.name), {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || entry.name === "others") continue;
      const dir = path.join(root, launch.name, entry.name);
      try {
        sessions.push({ dir, ...(await inspectSession(dir)) });
      } catch {
        // Incomplete or empty recordings are not upload candidates
      }
    }
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}
