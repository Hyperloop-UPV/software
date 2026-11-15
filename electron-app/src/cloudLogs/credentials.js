import { app, safeStorage } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

let memoryKey = "";

function canPersist() {
  return (
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" ||
      !["basic_text", "unknown"].includes(
        safeStorage.getSelectedStorageBackend(),
      ))
  );
}

const configPath = () => path.join(app.getPath("userData"), "cloud-logs.json");

async function readSettings() {
  try {
    return JSON.parse(await readFile(configPath(), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error("Could not read Cloud Logs credentials.");
  }
}

async function writeSettings(value) {
  await mkdir(path.dirname(configPath()), { recursive: true });
  const temporary = `${configPath()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, configPath());
}

export async function getCredentials() {
  const stored = await readSettings();
  let apiKey = memoryKey;
  if (!apiKey && stored.encryptedKey && canPersist()) {
    try {
      apiKey = safeStorage.decryptString(
        Buffer.from(stored.encryptedKey, "base64"),
      );
    } catch {
      throw new Error(
        "The saved API key cannot be unlocked. Replace it in Credentials.",
      );
    }
  }
  return { user: stored.user || "", apiKey };
}

export async function getCredentialsStatus() {
  const stored = await readSettings();
  return {
    user: stored.user || "",
    hasApiKey: !!(memoryKey || stored.encryptedKey),
    persistent: canPersist(),
  };
}

export async function setCredentials({ user, apiKey }) {
  if (
    typeof user !== "string" ||
    !user.trim() ||
    user.length > 200 ||
    (apiKey !== undefined &&
      (typeof apiKey !== "string" || apiKey.length > 8192))
  ) {
    throw new Error("Enter a valid user and API key.");
  }
  // Blank means preserve. A replacement can also recover an unreadable old key.
  const key = apiKey?.trim() || (await getCredentials()).apiKey;
  if (!key) throw new Error("Enter an API key.");
  const persistent = canPersist();
  await writeSettings({
    user: user.trim(),
    encryptedKey: persistent
      ? safeStorage.encryptString(key).toString("base64")
      : undefined,
  });
  memoryKey = persistent ? "" : key;
  return getCredentialsStatus();
}

export async function clearCredentials() {
  await writeSettings({});
  memoryKey = "";
  return getCredentialsStatus();
}
