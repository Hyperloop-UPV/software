import { Menu, dialog, app } from "electron";
import { getBinaryPath } from "../utils/paths.js";
import {
  startPacketSender,
  getPacketSenderProcess,
} from "../processes/packetSender.js";
import fs from "fs";

function createMenu(mainWindow) {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow.reload(),
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Control Station",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            loadView("control-station");
            loadView("control-station");
          },
        },
        {
          label: "Ethernet View",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            loadView("ethernet-view");
            loadView("ethernet-view");
          },
        },
        { type: "separator" },
        {
          label: "Toggle DevTools",
          accelerator: "F12",
          click: () => mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Start Packet Sender",
          click: () => {
            const packetSenderBin = getBinaryPath("packet-sender");
            if (!fs.existsSync(packetSenderBin)) {
              dialog.showMessageBox(mainWindow, {
                type: "warning",
                title: "Packet Sender Not Available",
                message: "Packet sender binary not found",
                detail: "This optional tool was not included in the build.",
              });
              return;
            }
            const packetSenderProcess = getPacketSenderProcess();
            if (!packetSenderProcess || packetSenderProcess.killed) {
              startPacketSender(["--help"]);
            }
          },
        },
        {
          label: "Stop Packet Sender",
          click: () => {
            stopPacketSender();
            const packetSenderProcess = getPacketSenderProcess();
            if (packetSenderProcess && !packetSenderProcess.killed) {
              stopPacketSender();
            }
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About",
              message: "Hyperloop UPV Control Station",
              detail:
                "Version 1.0.0\n\nControl and monitoring software for Hyperloop pod.",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

export { createMenu };
