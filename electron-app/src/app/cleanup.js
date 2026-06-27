/**
 * @module app/cleanup
 * @description Cleanup utilities for terminating leftover processes from previous sessions.
 */

import { execSync } from "child_process";
import { logger } from "../utils/logger.js";

/**
 * Terminates any leftover backend processes from previous sessions.
 * Prevents backend/log windows from appearing before user selects a mode.
 * @returns {Promise<void>}
 */
async function cleanupLeftoverBackendProcesses() {
  try {
    const out = execSync("pgrep -f backend-linux-amd64 || true").toString().trim();
    if (out) {
      const pids = out.split(/\s+/).filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), "SIGTERM");
          logger.electron.info(`Terminated leftover backend pid=${pid}`);
        } catch (e) {
          logger.electron.debug(`Failed to terminate pid ${pid}:`, e);
        }
      }
    }
  } catch (e) {
    logger.electron.debug("Error checking/killing leftover backends:", e);
  }
}

export { cleanupLeftoverBackendProcesses };
