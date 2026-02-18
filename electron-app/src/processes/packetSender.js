/**
 * @module processes
 * @description Packet sender process management for spawning and controlling the packet-sender binary.
 * Handles starting, stopping, and restarting the packet sender process with proper logging and error handling.
 */

import { spawn } from "child_process";
import fs from "fs";
import { logger } from "../utils/logger.js";
import { getBinaryPath } from "../utils/paths.js";

// Store the packet sender process instance
let packetSenderProcess = null;

/**
 * Starts the packet sender process by spawning the packet-sender binary with optional arguments.
 * Sets up event handlers for stdout and stderr with appropriate logging.
 * @param {string[]} [args=[]] - Optional array of command-line arguments to pass to the packet-sender binary.
 * @returns {import("child_process").ChildProcessWithoutNullStreams | null} The spawned ChildProcess object, or null if the binary is not found.
 * @example
 * const process = startPacketSender(["--port", "8080"]);
 * startPacketSender();
 */
function startPacketSender(args = []) {
  // Get the path to the packet-sender binary
  const packetSenderBin = getBinaryPath("packet-sender");

  // Check if binary exists before attempting to start
  if (!fs.existsSync(packetSenderBin)) {
    logger.packetSender.error(
      `Packet sender binary not found: ${packetSenderBin}`
    );
    return null;
  }

  // Log the start command with arguments
  logger.packetSender.info(
    `Starting packet sender: ${packetSenderBin} ${args.join(" ")}`
  );

  // Spawn the packet sender process with provided arguments
  const process = spawn(packetSenderBin, args);

  // Log stdout output from packet sender
  process.stdout.on("data", (data) => {
    logger.packetSender.info(`${data.toString().trim()}`);
  });

  // Log stderr output as errors
  process.stderr.on("data", (data) => {
    logger.packetSender.error(`${data.toString().trim()}`);
  });

  // Store the process reference
  packetSenderProcess = process;
  // Return the process for external use
  return process;
}

/**
 * Stops the packet sender process by sending a SIGTERM signal.
 * Only attempts to stop if the process exists and has not already been killed.
 * @returns {void}
 * @example
 * stopPacketSender();
 */
function stopPacketSender() {
  // Only stop if process exists and is still running
  if (packetSenderProcess && !packetSenderProcess.killed) {
    logger.packetSender.info("Stopping packet sender...");
    // Send termination signal
    packetSenderProcess.kill("SIGTERM");
    // Clear the process reference
    packetSenderProcess = null;
  }
}

/**
 * Restarts the packet sender process by stopping the current process and starting a new one with help arguments.
 * Waits 500ms between stopping and starting to ensure proper cleanup.
 * @returns {void}
 * @example
 * restartPacketSender();
 */
function restartPacketSender() {
  // Only restart if process is currently running
  if (packetSenderProcess && !packetSenderProcess.killed) {
    // Stop current process first
    stopPacketSender();
    // Wait before starting new process to ensure cleanup
    setTimeout(() => {
      // Start with help arguments
      startPacketSender(["random"]);
    }, 500);
  }
}

/**
 * Returns the current packet sender process instance.
 * @returns {import("child_process").ChildProcessWithoutNullStreams | null} The current ChildProcess object, or null if no process is running.
 * @example
 * const process = getPacketSenderProcess();
 * if (process) {
 *   console.log("Packet sender is running");
 * }
 */
function getPacketSenderProcess() {
  // Return the stored process instance
  return packetSenderProcess;
}

export {
  getPacketSenderProcess,
  restartPacketSender,
  startPacketSender,
  stopPacketSender,
};
