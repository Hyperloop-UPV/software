import { spawn } from "child_process";
import { getBinaryPath } from "../utils/paths.js";
import fs from "fs";
import { logger } from "../utils/logger.js";

let packetSenderProcess = null;

function startPacketSender(args = []) {
  const packetSenderBin = getBinaryPath("packet-sender");

  if (!fs.existsSync(packetSenderBin)) {
    logger.packetSender.error(`Packet sender binary not found: ${packetSenderBin}`);
    return null;
  }

  logger.packetSender.info(`Starting packet sender: ${packetSenderBin} ${args.join(" ")}`);

  const process = spawn(packetSenderBin, args);

  process.stdout.on("data", (data) => {
    logger.packetSender.info(`${data.toString().trim()}`);
  });

  process.stderr.on("data", (data) => {
    logger.packetSender.error(`${data.toString().trim()}`);
  });

  packetSenderProcess = process;
  return process;
}

function stopPacketSender() {
  if (packetSenderProcess && !packetSenderProcess.killed) {
    logger.packetSender.info("Stopping packet sender...");
    packetSenderProcess.kill("SIGTERM");
    packetSenderProcess = null;
  }
}

function restartPacketSender() {
  if (packetSenderProcess && !packetSenderProcess.killed) {
    stopPacketSender();
    setTimeout(() => {
      startPacketSender(["--help"]);
    }, 500);
  }
}

function getPacketSenderProcess() {
  return packetSenderProcess;
}

export {
  startPacketSender,
  stopPacketSender,
  restartPacketSender,
  getPacketSenderProcess,
};
