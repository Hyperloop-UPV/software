import { lstat, readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "../config/configInstance.js";
import { getBackendWorkingDir } from "../utils/paths.js";

export const MAX_BYTES = 4 * 1024 ** 3;
export const MAX_FILES = 10000;
// Cloud archives keep every regular file below a session root, including files
// from future backend logger subfolders that this app does not know yet.
export const isSessionFile = (name) =>
  name === "logger_settings.json" ||
  (!name.startsWith("cloud-log.json") && !name.startsWith("../"));

export async function getLogsRoot() {
  const config = await readConfig();
  return path.resolve(
    getBackendWorkingDir(),
    config.logging?.logging_path || ".",
    "logger",
  );
}

export async function getCloudRoot() {
  const root = path.join(await getLogsRoot(), "cloud-logs");
  await mkdir(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink())
    throw new Error("Cloud Logs folder cannot be a symbolic link.");
  return root;
}

/** Validate one recording, not the parent app launch. Refuse symlinks. */
export async function inspectSession(dir) {
  if (!(await lstat(dir)).isDirectory())
    throw new Error("Select a logging session folder.");
  const files = [];
  let bytes = 0;
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
  if (!files.some((f) => f.name === "logger_settings.json"))
    throw new Error(
      "Select a recording containing logger_settings.json, not the app launch folder.",
    );
  const settings = JSON.parse(
    await readFile(path.join(dir, "logger_settings.json"), "utf8"),
  );
  if (
    typeof settings.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2}/.test(settings.date)
  )
    throw new Error("Session has no valid recording date.");
  return {
    name: path.basename(dir),
    launch: path.basename(path.dirname(dir)),
    date: settings.date,
    bytes,
    fileCount: files.length,
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

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
        /* Incomplete/empty recordings are not upload candidates. */
      }
    }
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}
