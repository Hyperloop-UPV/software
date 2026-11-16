import { BrowserWindow, dialog, ipcMain } from "electron";
import { createHash, randomUUID } from "node:crypto";
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
import { pathToFileURL } from "node:url";
import { getAppPath } from "../utils/paths.js";
import * as credentials from "./credentials.js";
import * as client from "./client.js";
import { compressSession, extractSession } from "./archive.js";
import {
  findLocalSessions,
  getCloudRoot,
  getLogsRoot,
  inspectSession,
  MAX_BYTES,
} from "./sessions.js";

const allowedURLs = ["logging-view", "testing-view"].map(
  (view) =>
    pathToFileURL(path.join(getAppPath(), "renderer", view, "index.html")).href,
);

function assertSender(event) {
  const url = event.senderFrame?.url?.split(/[?#]/)[0];
  if (
    event.senderFrame !== event.sender.mainFrame ||
    !allowedURLs.includes(url)
  )
    throw new Error(
      "Cloud Logs is only available to local Logging and Testing views.",
    );
}

function text(value, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Invalid Cloud Logs request.");
  return value;
}

export function setupCloudLogsHandlers() {
  const selected = new Map();
  let transferRunning = false;
  let credentialsQueue = Promise.resolve();
  const handle = (name, fn) =>
    ipcMain.handle(`cloud-logs:${name}`, (event, input) => {
      assertSender(event);
      return fn(event, input);
    });
  const register = (event, session, dir) => {
    const id = randomUUID();
    selected.set(id, { owner: event.sender.id, dir });
    // Bound stale folder grants from repeated discovery/pickers.
    if (selected.size > 2000) selected.delete(selected.keys().next().value);
    const { files, ...summary } = session;
    void files;
    return { ...summary, id };
  };
  const auth = async () => {
    await credentialsQueue;
    const value = await credentials.getCredentials();
    if (!value.user || !value.apiKey)
      throw new Error("Configure your user and API key in Credentials first.");
    return value;
  };
  const changeCredentials = (fn) => {
    const result = credentialsQueue.then(fn);
    credentialsQueue = result.catch(() => {});
    return result;
  };
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
  handle("list", async (_event, cursor) =>
    client.listLogs({
      credentials: await auth(),
      cursor: cursor === undefined ? undefined : text(cursor),
    }),
  );
  handle("tags", async (_event, query) => {
    if (typeof query !== "string" || query.length > 200)
      throw new Error("Invalid tag query.");
    return client.autocompleteTags({ credentials: await auth(), query });
  });
  handle("upload", (event, input) =>
    transfer(event, input, async (report) => {
      const grant = selected.get(input.sessionId);
      if (!grant || grant.owner !== event.sender.id)
        throw new Error("Select the session again before uploading.");
      if (
        typeof input.notes !== "string" ||
        input.notes.length > 10000 ||
        !Array.isArray(input.tags) ||
        input.tags.length > 30
      )
        throw new Error("Invalid notes or tags.");
      const tags = [...new Set(input.tags.map((tag) => text(tag, 100)))];
      const account = await auth();
      const temp = await mkdtemp(path.join(tmpdir(), "cloud-logs-upload-"));
      try {
        report("compressing", 0);
        const archivePath = path.join(temp, "session.zip");
        const session = await compressSession(
          grant.dir,
          archivePath,
          (n, total) => report("compressing", n, total),
        );
        report("uploading");
        return await client.uploadLog({
          credentials: account,
          archivePath,
          metadata: {
            user: account.user,
            notes: input.notes.trim(),
            tags,
            date: session.date,
          },
        });
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    }),
  );
  handle("download", (event, input) =>
    transfer(event, input, async (report) => {
      const id = text(input.id);
      const account = await auth();
      const root = await getCloudRoot();
      const destination = path.join(
        root,
        createHash("sha256").update(id).digest("hex"),
      );
      try {
        const info = JSON.parse(
          await readFile(path.join(destination, "cloud-log.json"), "utf8"),
        );
        if (info.id !== id)
          throw new Error("Downloaded session identity mismatch.");
        const session = await inspectSession(destination);
        return { id, path: destination, date: session.date };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      // Staging on the destination filesystem makes the final rename atomic.
      const temp = await mkdtemp(path.join(root, ".download-"));
      try {
        const archivePath = path.join(temp, "session.zip");
        report("downloading");
        await client.downloadLog({
          credentials: account,
          id,
          destination: archivePath,
          maxBytes: MAX_BYTES,
        });
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
          JSON.stringify({ id, date: session.date }),
        );
        await rename(extracted, destination);
        return { id, path: destination, date: session.date };
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    }),
  );
  handle("downloads", async () => {
    const root = await getCloudRoot();
    const items = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
      const dir = path.join(root, entry.name);
      try {
        const info = JSON.parse(
          await readFile(path.join(dir, "cloud-log.json"), "utf8"),
        );
        const session = await inspectSession(dir);
        items.push({ id: text(info.id), date: session.date, path: dir });
      } catch {
        /* Do not expose partial or invalid downloads. */
      }
    }
    return items.sort((a, b) => b.date.localeCompare(a.date));
  });
}
