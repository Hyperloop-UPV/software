import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import archiver from "archiver";

const env = vi.hoisted(() => ({ root: "", secure: true, locked: false }));
vi.mock("electron", () => ({
  app: { getPath: () => env.root },
  safeStorage: {
    isEncryptionAvailable: () => env.secure,
    getSelectedStorageBackend: () =>
      env.secure ? "gnome_libsecret" : "basic_text",
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => {
      if (env.locked) throw new Error("locked");
      return value.toString().slice(10);
    },
  },
}));
vi.mock("../../utils/paths.js", () => ({
  getBackendWorkingDir: () => env.root,
}));
vi.mock("../../config/configInstance.js", () => ({
  readConfig: async () => ({ logging: { logging_path: "." } }),
}));

import { compressSession, extractSession } from "../archive.js";
import {
  findLocalSessions,
  getCloudRoot,
  inspectSession,
} from "../sessions.js";
import {
  clearCredentials,
  getCredentials,
  getCredentialsStatus,
  setCredentials,
} from "../credentials.js";

let session;
const settings = {
  date: "2026-11-15T12-30-00",
  time_unit: "us",
  adj_commit_hash: "abc123",
};
beforeEach(async () => {
  env.root = await mkdtemp(path.join(tmpdir(), "cloud-logs-test-"));
  env.secure = true;
  env.locked = false;
  session = path.join(env.root, "logger", "2026-11-15T12-00-00", settings.date);
  await mkdir(path.join(session, "data", "BCU"), { recursive: true });
  await mkdir(path.join(session, "protections"));
  await writeFile(
    path.join(session, "logger_settings.json"),
    JSON.stringify(settings),
  );
  await writeFile(
    path.join(session, "data", "BCU", "speed.csv"),
    "0,BCU,backend,4\n1000,BCU,backend,5\n",
  );
  await writeFile(
    path.join(session, "protections", "BCU.csv"),
    "0,BCU,backend,FAULT\n",
  );
});
afterEach(async () => {
  await clearCredentials();
  await rm(env.root, { recursive: true, force: true });
});

async function zipEntries(entries, name = "input.zip") {
  const dest = path.join(env.root, name);
  const archive = archiver("zip");
  const output = pipeline(archive, createWriteStream(dest));
  for (const [file, content] of entries)
    archive.append(content, { name: file });
  await Promise.all([archive.finalize(), output]);
  return dest;
}

describe("session archives", () => {
  it("round-trips every session file, including unfamiliar subfolders", async () => {
    await writeFile(path.join(session, "config.toml"), 'api_key="private"');
    await mkdir(path.join(session, "other", "metadata"), { recursive: true });
    await writeFile(
      path.join(session, "other", "metadata", "notes.txt"),
      "reserved logger data",
    );
    const zip = path.join(env.root, "session.zip");
    const progress = vi.fn();
    const original = await compressSession(session, zip, progress);
    const extracted = path.join(env.root, "extracted");
    const result = await extractSession(zip, extracted, vi.fn());
    expect(result.date).toBe(settings.date);
    expect(result.fileCount).toBe(5);
    expect(result.bytes).toBe(original.bytes);
    expect(progress).toHaveBeenCalledWith(5, 5);
    expect(
      await readFile(path.join(extracted, "data/BCU/speed.csv"), "utf8"),
    ).toContain("1000,BCU,backend,5");
    expect(
      await readFile(path.join(extracted, "other/metadata/notes.txt"), "utf8"),
    ).toBe("reserved logger data");
    expect(
      await readFile(path.join(extracted, "config.toml"), "utf8"),
    ).toContain("private");
  });
  it("discovers recordings underneath launches, excluding cloud downloads", async () => {
    const cloud = await getCloudRoot();
    await mkdir(path.join(cloud, "cached"));
    const sessions = await findLocalSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe(settings.date);
    await expect(inspectSession(path.dirname(session))).rejects.toThrow(
      "Select a recording",
    );
  });
  it("refuses symbolic links in a local recording", async () => {
    await symlink(
      path.join(session, "logger_settings.json"),
      path.join(session, "data", "link"),
    );
    await expect(inspectSession(session)).rejects.toThrow("symbolic links");
  });
  it("refuses a recording that changes while compressing", async () => {
    let changed = false;
    const { appendFileSync } = await import("node:fs");
    await expect(
      compressSession(session, path.join(env.root, "changing.zip"), () => {
        if (!changed) {
          changed = true;
          appendFileSync(
            path.join(session, "data/BCU/speed.csv"),
            "2000,BCU,backend,6\n",
          );
        }
      }),
    ).rejects.toThrow("changed during compression");
  });
  it("rejects zip traversal without creating files outside the target", async () => {
    const zip = await zipEntries([["aa/escape.csv", "bad"]]);
    const bytes = await readFile(zip);
    const from = Buffer.from("aa/escape.csv");
    let index = bytes.indexOf(from);
    while (index !== -1) {
      bytes.set(Buffer.from("../escape.csv"), index);
      index = bytes.indexOf(from, index + from.length);
    }
    await writeFile(zip, bytes);
    await expect(
      extractSession(zip, path.join(env.root, "out"), vi.fn()),
    ).rejects.toThrow();
    await expect(readFile(path.join(env.root, "escape.csv"))).rejects.toThrow();
  });
  it("rejects duplicate entries instead of overwriting", async () => {
    const zip = await zipEntries([
      ["logger_settings.json", "{}"],
      ["logger_settings.json", "{}"],
    ]);
    await expect(
      extractSession(zip, path.join(env.root, "out"), vi.fn()),
    ).rejects.toThrow();
  });
});

describe("credentials", () => {
  it("returns only credential status to the UI and preserves a blank replacement", async () => {
    expect(await setCredentials({ user: "alice", apiKey: "secret" })).toEqual({
      user: "alice",
      hasApiKey: true,
      persistent: true,
    });
    expect(
      await readFile(path.join(env.root, "cloud-logs.json"), "utf8"),
    ).not.toContain("secret");
    await setCredentials({ user: "bob", apiKey: "" });
    expect(await getCredentials()).toEqual({ user: "bob", apiKey: "secret" });
    await clearCredentials();
    expect((await getCredentialsStatus()).hasApiKey).toBe(false);
  });
  it("keeps the key only in memory when secure storage is unavailable", async () => {
    env.secure = false;
    expect(
      (await setCredentials({ user: "alice", apiKey: "memory-only" }))
        .persistent,
    ).toBe(false);
    expect(await readFile(path.join(env.root, "cloud-logs.json"), "utf8")).toBe(
      '{"user":"alice"}',
    );
    expect((await getCredentials()).apiKey).toBe("memory-only");
  });
  it("allows replacing an old key that cannot be decrypted", async () => {
    await setCredentials({ user: "alice", apiKey: "old" });
    env.locked = true;
    await expect(
      setCredentials({ user: "alice", apiKey: "new" }),
    ).resolves.toMatchObject({ hasApiKey: true });
    env.locked = false;
    expect((await getCredentials()).apiKey).toBe("new");
  });
});
