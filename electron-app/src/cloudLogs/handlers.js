/**
 * @module cloudLogs
 * @description IPC handlers for Cloud Logs operations between the main process and renderer.
 * Registers handlers for:
 * - Credential management
 * - Session discovery and selection
 * - Cloud log listing and tag autocomplete
 * - Archive compression, upload, download, and extraction
 */

import { BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getAppPath } from "../utils/paths.js";
import * as credentials from "./credentials.js";
import * as client from "./client.js";
import { compressSession, extractSession } from "./archive.js";
import {
  findLocalSessions,
  formatDownloadedFolderName,
  formatSessionZipName,
  getCloudRoot,
  getLogsRoot,
  inspectSession,
  MAX_BYTES,
} from "./sessions.js";

/**
 * Restricts IPC access to top-level main frames of authorized local views.
 * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
 * @throws {Error} If the sender frame is not an authorized local view main frame.
 * @returns {void}
 */
export function assertSender(event) {
  if (
    !event?.sender ||
    !event?.senderFrame ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error(
      "Cloud Logs is only available to local Logging and Testing views.",
    );
  }
  const rawUrl = event.senderFrame?.url?.split(/[?#]/)[0];
  if (!rawUrl) {
    throw new Error(
      "Cloud Logs is only available to local Logging and Testing views.",
    );
  }
  try {
    const pathModule = process.platform === "win32" ? path.win32 : path;
    let filePath;
    try {
      filePath = rawUrl.startsWith("file:")
        ? fileURLToPath(rawUrl, { windows: process.platform === "win32" })
        : pathModule.resolve(rawUrl);
    } catch {
      filePath = pathModule.resolve(rawUrl);
    }
    const resolvedPath = pathModule.resolve(filePath);
    const allowedPaths = ["logging-view", "testing-view"].map((view) =>
      pathModule.resolve(getAppPath(), "renderer", view, "index.html"),
    );
    const isAllowed = allowedPaths.some((target) =>
      process.platform === "win32"
        ? target.toLowerCase() === resolvedPath.toLowerCase()
        : target === resolvedPath,
    );
    if (!isAllowed) {
      throw new Error(
        "Cloud Logs is only available to local Logging and Testing views.",
      );
    }
  } catch (error) {
    if (
      error.message ===
      "Cloud Logs is only available to local Logging and Testing views."
    ) {
      throw error;
    }
    throw new Error(
      "Cloud Logs is only available to local Logging and Testing views.",
    );
  }
}

/**
 * Validates a non-empty string and enforces a maximum character limit.
 * @param {unknown} value - Value to validate.
 * @param {number} [max=500] - Maximum allowed character length.
 * @returns {string} The validated string.
 * @throws {Error} If the value is not a string, is empty, or exceeds the limit.
 */
function text(value, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Invalid Cloud Logs request.");
  return value;
}

/**
 * Sanitizes client errors to prevent credential or URL leakage in UI alerts.
 * @param {Error | unknown} error - The error to sanitize.
 * @returns {Error} A sanitized Error object safe for display in the UI.
 */
function cleanClientError(error) {
  if (!error) return new Error("Cloud Logs operation failed.");
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);
  const sanitized = client.sanitizeMessage(raw).trim();
  return new Error(sanitized || "Cloud Logs operation failed.");
}

/**
 * Finds an already-downloaded valid session by cloud log ID.
 * @param {string} root - The cloud logs root directory path.
 * @param {string} id - The cloud log ID to search for.
 * @returns {Promise<{dir: string, info: Object, session: Object} | null>} Existing download info, or null if not found.
 */
async function findExistingDownload(root, id) {
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dir = path.join(root, entry.name);
      try {
        const info = JSON.parse(
          await readFile(path.join(dir, "cloud-log.json"), "utf8"),
        );
        if (info.id === id) {
          const session = await inspectSession(dir);
          return { dir, info, session };
        }
      } catch (err) {
        // If the directory was specifically for this ID but is corrupt, clean it up
        if (err.code !== "ENOENT") {
          try {
            const raw = await readFile(
              path.join(dir, "cloud-log.json"),
              "utf8",
            );
            const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const idPattern = new RegExp(`"id"\\s*:\\s*"${escapedId}"`);
            if (idPattern.test(raw)) {
              await rm(dir, { recursive: true, force: true });
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* root may not exist yet */
  }
  return null;
}

/**
 * Registers all IPC handlers for Cloud Logs management, listing, uploads, and downloads.
 * Should be called once during main process IPC initialization.
 * @returns {void}
 */
export function setupCloudLogsHandlers() {
  const selected = new Map();
  let transferRunning = false;
  let credentialsQueue = Promise.resolve();

  /**
   * Helper to register an IPC handler with sender verification.
   * @param {string} name - Handler channel name suffix (prefixed with "cloud-logs:").
   * @param {function(import("electron").IpcMainInvokeEvent, any): Promise<any> | any} fn - The handler implementation.
   * @returns {void}
   */
  const handle = (name, fn) =>
    ipcMain.handle(`cloud-logs:${name}`, async (event, input) => {
      assertSender(event);
      return fn(event, input);
    });

  /**
   * Registers a session folder grant for the requesting sender webContents.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {Object} session - The inspected session data.
   * @param {string} dir - Directory path of the session.
   * @returns {Object} Session summary with generated session grant ID.
   */
  const register = (event, session, dir) => {
    const id = randomUUID();
    selected.set(id, { owner: event.sender.id, dir, date: session.date });
    // Bound stale folder grants from repeated discovery/pickers.
    if (selected.size > 2000) selected.delete(selected.keys().next().value);
    const { files, ...summary } = session;
    void files;
    return { ...summary, id };
  };

  /**
   * Reads and verifies stored credentials, throwing if unconfigured.
   * @returns {Promise<{user: string, apiKey: string}>} Valid credentials object.
   * @throws {Error} If credentials are not configured.
   */
  const auth = async () => {
    await credentialsQueue;
    const value = await credentials.getCredentials();
    if (!value.user || !value.apiKey)
      throw new Error("Configure your user and API key in Credentials first.");
    return value;
  };

  /**
   * Queues a credential mutation operation to prevent concurrent writes.
   * @param {function(): Promise<any>} fn - The operation to execute.
   * @returns {Promise<any>} The result of the mutation operation.
   */
  const changeCredentials = (fn) => {
    const result = credentialsQueue.then(fn);
    credentialsQueue = result.catch(() => {});
    return result;
  };

  /**
   * Locks transfer execution and sets up progress reporting for uploads and downloads.
   * @param {import("electron").IpcMainInvokeEvent} event - The IPC event object.
   * @param {Object} input - Transfer input containing requestId.
   * @param {function(function(string, number=, number=): void): Promise<any>} fn - Transfer worker callback.
   * @returns {Promise<any>} Result returned by the transfer worker callback.
   * @throws {Error} If another transfer is currently active.
   */
  const transfer = async (event, input, fn) => {
    text(input?.requestId, 100);
    if (transferRunning)
      throw new Error("Another Cloud Logs transfer is in progress.");
    transferRunning = true;
    const report = (phase, completed, total) => {
      if (!event.sender.isDestroyed())
        event.sender.send("cloud-logs:progress", {
          requestId: input.requestId,
          phase,
          completed,
          total,
        });
    };
    try {
      return await fn(report);
    } finally {
      transferRunning = false;
    }
  };

  handle("credentials-status", () =>
    credentialsQueue.then(() => credentials.getCredentialsStatus()),
  );
  handle("credentials-save", (_event, input) =>
    changeCredentials(() => credentials.setCredentials(input)),
  );
  handle("credentials-clear", () =>
    changeCredentials(() => credentials.clearCredentials()),
  );
  handle("local-sessions", async (event) => {
    await getCloudRoot();
    const sessions = await findLocalSessions();
    return sessions.map(({ dir, ...session }) => register(event, session, dir));
  });
  handle("select-session", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Select a completed logging session",
        defaultPath: await getLogsRoot(),
        properties: ["openDirectory"],
      },
    );
    if (result.canceled) return null;
    const dir = result.filePaths[0];
    return register(event, await inspectSession(dir), dir);
  });
  handle("list", async (_event, cursor) => {
    let sanitizedCursor;
    if (cursor !== undefined && cursor !== null) {
      if (typeof cursor !== "string") {
        throw new Error("Invalid Cloud Logs request.");
      }
      const trimmed = cursor.trim();
      if (trimmed.length > 0) {
        sanitizedCursor = text(trimmed);
      }
    }
    try {
      return await client.listLogs({
        credentials: await auth(),
        cursor: sanitizedCursor,
      });
    } catch (error) {
      throw cleanClientError(error);
    }
  });
  handle("tags", async (_event, query) => {
    if (typeof query !== "string" || query.length > 200)
      throw new Error("Invalid tag query.");
    try {
      return await client.autocompleteTags({
        credentials: await auth(),
        query,
      });
    } catch (error) {
      throw cleanClientError(error);
    }
  });
  handle("upload", (event, input) =>
    transfer(event, input, async (report) => {
      const grant = selected.get(input?.sessionId);
      if (!grant || grant.owner !== event.sender.id)
        throw new Error("Select the session again before uploading.");
      if (
        typeof input?.notes !== "string" ||
        input.notes.length > 10000 ||
        !Array.isArray(input.tags) ||
        input.tags.length > 30
      )
        throw new Error("Invalid notes or tags.");
      const title =
        typeof input?.title === "string" && input.title.trim()
          ? text(input.title.trim(), 200)
          : "";
      const tags = [...new Set(input.tags.map((tag) => text(tag, 100)))];
      const account = await auth();
      const temp = await mkdtemp(path.join(tmpdir(), "cloud-logs-upload-"));
      try {
        report("compressing", 0);
        const archiveName = formatSessionZipName(grant.date, title);
        const archivePath = path.join(temp, archiveName);
        const session = await compressSession(
          grant.dir,
          archivePath,
          (n, total) => report("compressing", n, total),
        );
        report("uploading");
        try {
          return await client.uploadLog({
            credentials: account,
            archivePath,
            metadata: {
              fileName: archiveName,
              title: title || undefined,
              user: account.user,
              notes: input.notes.trim(),
              tags,
              date: session.date,
            },
          });
        } catch (error) {
          throw cleanClientError(error);
        }
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    }),
  );
  handle("download", (event, input) =>
    transfer(event, input, async (report) => {
      const id = text(input?.id);
      const title =
        typeof input?.title === "string" && input.title.trim()
          ? text(input.title.trim(), 200)
          : "";
      const rawFileName =
        typeof input?.fileName === "string" && input.fileName.trim()
          ? text(input.fileName.trim(), 255)
          : "";
      const fileName = rawFileName
        ? path.basename(rawFileName).replace(/[/\\?%*:|"<>]/g, "_")
        : "";
      const archiveName = fileName
        ? fileName.endsWith(".zip")
          ? fileName
          : `${fileName}.zip`
        : title
          ? `${title.replace(/[/\\?%*:|"<>]/g, "_")}.zip`
          : `${id}.zip`;
      const derivedTitle =
        title || (fileName ? fileName.replace(/\.zip$/i, "") : "");
      const account = await auth();
      const root = await getCloudRoot();
      // Return cached copy if already downloaded and valid
      const existing = await findExistingDownload(root, id);
      if (existing) {
        return {
          id,
          path: existing.dir,
          date: existing.session.date,
          title:
            existing.info.title ||
            (existing.info.fileName
              ? existing.info.fileName.replace(/\.zip$/i, "")
              : ""),
          fileName: existing.info.fileName || "",
        };
      }

      // Staging on the destination filesystem makes the final rename atomic.
      const temp = await mkdtemp(path.join(root, ".download-"));
      try {
        const archivePath = path.join(temp, archiveName);
        report("downloading");
        try {
          await client.downloadLog({
            credentials: account,
            id,
            destination: archivePath,
            maxBytes: MAX_BYTES,
          });
        } catch (error) {
          throw cleanClientError(error);
        }
        if ((await stat(archivePath)).size > MAX_BYTES)
          throw new Error("Downloaded archive exceeds 4 GiB.");
        report("extracting", 0);
        const extracted = path.join(temp, "session");
        const session = await extractSession(
          archivePath,
          extracted,
          (n, total) => report("extracting", n, total),
        );
        await writeFile(
          path.join(extracted, "cloud-log.json"),
          JSON.stringify({
            id,
            date: session.date,
            title: derivedTitle,
            fileName: fileName || archiveName,
          }),
        );

        // Destination folder format: <sanitized fileName or title>-<hh-mm-ss>
        const folderName = formatDownloadedFolderName(session.date, {
          fileName,
          title,
          id,
        });

        // Disambiguate folder name if destination already exists for a different session
        let targetName = folderName;
        let destination = path.join(root, targetName);
        let counter = 1;
        while (true) {
          try {
            await stat(destination);
            let matchesCurrentId = false;
            try {
              const existingRaw = await readFile(
                path.join(destination, "cloud-log.json"),
                "utf8",
              );
              const existingInfo = JSON.parse(existingRaw);
              if (existingInfo.id === id) {
                matchesCurrentId = true;
              }
            } catch {
              matchesCurrentId = false;
            }

            if (matchesCurrentId) {
              break;
            }

            counter++;
            targetName = `${folderName}_${counter}`;
            destination = path.join(root, targetName);
          } catch (err) {
            if (err.code === "ENOENT") break;
            throw err;
          }
        }

        // Remove stale directories matching this cloud log ID
        try {
          for (const entry of await readdir(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
            const dir = path.join(root, entry.name);
            if (dir === destination) continue;
            try {
              const info = JSON.parse(
                await readFile(path.join(dir, "cloud-log.json"), "utf8"),
              );
              if (info.id === id) {
                await rm(dir, { recursive: true, force: true });
              }
            } catch {
              /* skip */
            }
          }
        } catch {}

        await rm(destination, { recursive: true, force: true });
        await rename(extracted, destination);
        return {
          id,
          path: destination,
          date: session.date,
          title: derivedTitle,
          fileName: fileName || archiveName,
        };
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    }),
  );
  handle("downloads", async () => {
    const root = await getCloudRoot();
    const items = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dir = path.join(root, entry.name);
      try {
        const info = JSON.parse(
          await readFile(path.join(dir, "cloud-log.json"), "utf8"),
        );
        const session = await inspectSession(dir);
        items.push({
          id: text(info.id),
          date: session.date,
          path: dir,
          title:
            info.title ||
            (info.fileName ? info.fileName.replace(/\.zip$/i, "") : ""),
          fileName: info.fileName || "",
        });
      } catch {
        /* Do not expose partial or invalid downloads. */
      }
    }
    return items.sort((a, b) => b.date.localeCompare(a.date));
  });
}
