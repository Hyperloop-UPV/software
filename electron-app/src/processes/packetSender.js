import { spawn } from "child_process";
import { getBinaryPath } from "../utils/paths.js";
import fs from "fs";

let packetSenderProcess = null;

function startPacketSender(args = []) {
  const packetSenderBin = getBinaryPath("packet-sender");

  if (!fs.existsSync(packetSenderBin)) {
    console.error(`Packet sender binary not found: ${packetSenderBin}`);
    return null;
  }

  console.log(`Starting packet sender: ${packetSenderBin} ${args.join(" ")}`);

  const process = spawn(packetSenderBin, args);

  process.stdout.on("data", (data) => {
    console.log(`[Packet Sender] ${data.toString().trim()}`);
  });

  process.stderr.on("data", (data) => {
    console.error(`[Packet Sender Error] ${data.toString().trim()}`);
  });

  packetSenderProcess = process;
  return process;
}

function stopPacketSender() {
  if (packetSenderProcess && !packetSenderProcess.killed) {
    console.log("Stopping packet sender...");
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
