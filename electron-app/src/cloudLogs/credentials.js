/**
 * @module cloudLogs
 * @description Cloud Logs credential storage and encryption management.
 * Handles reading, writing, and safe storage of user credentials and API keys.
 */

import { app, safeStorage } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// In-memory fallback when OS-level persistent encryption is unavailable
let memoryKey = "";

/**
 * Checks whether OS-level persistent encryption is available and secure.
 * Avoids persisting to disk on Linux if safeStorage uses an unencrypted backend.
 * @returns {boolean} True if encryption can be persisted securely to disk.
 */
function canPersist() {
  return (
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" ||
      !["basic_text", "unknown"].includes(
        safeStorage.getSelectedStorageBackend(),
      ))
  );
}

/**
 * Resolves the path to the credentials configuration file.
 * @returns {string} Absolute path to cloud-logs.json in userData.
 */
const configPath = () => path.join(app.getPath("userData"), "cloud-logs.json");

/**
 * Reads stored settings from the configuration file.
 * @returns {Promise<Object>} Stored settings object or empty object if file does not exist.
 * @throws {Error} If reading or parsing fails for reasons other than missing file.
 */
async function readSettings() {
  try {
    return JSON.parse(await readFile(configPath(), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error("Could not read Cloud Logs credentials.");
  }
}

/**
 * Atomically writes settings with owner-only (0o600) permissions.
 * @param {Object} value - Settings object to write.
 * @returns {Promise<void>}
 */
async function writeSettings(value) {
  await mkdir(path.dirname(configPath()), { recursive: true });
  const temporary = `${configPath()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, configPath());
}

/**
 * Retrieves the active user and decrypted API key from memory or OS keychain.
 * @returns {Promise<{ user: string, apiKey: string }>} Active credentials object.
 * @throws {Error} If the saved API key cannot be decrypted.
 */
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

/**
 * Returns credential status for UI badges without exposing the raw API key.
 * @returns {Promise<{ user: string, hasApiKey: boolean, persistent: boolean }>} Credential status.
 */
export async function getCredentialsStatus() {
  const stored = await readSettings();
  return {
    user: stored.user || "",
    hasApiKey: !!(memoryKey || (stored.encryptedKey && canPersist())),
    persistent: canPersist(),
  };
}

/**
 * Updates stored credentials with optional API key encryption.
 * Omitting apiKey preserves the existing key.
 * @param {Object} credentials - Credential parameters.
 * @param {string} credentials.user - Username.
 * @param {string} [credentials.apiKey] - Optional API key.
 * @returns {Promise<{ user: string, hasApiKey: boolean, persistent: boolean }>} Updated credential status.
 * @throws {Error} If user or apiKey validation fails.
 */
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
  // Blank API key preserves existing key or recovers previous key
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

/**
 * Clears stored credentials and resets in-memory API key.
 * @returns {Promise<{ user: string, hasApiKey: boolean, persistent: boolean }>} Cleared credential status.
 */
export async function clearCredentials() {
  await writeSettings({});
  memoryKey = "";
  return getCredentialsStatus();
}
