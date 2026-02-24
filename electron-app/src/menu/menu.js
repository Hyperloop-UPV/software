/**
 * @module menu
 * @description Application menu creation and management for the Electron application.
 * Defines menu structure with File, View, Tools, and Help sections with keyboard shortcuts and actions.
 */

import { Menu, app, dialog } from "electron";
import fs from "fs";
import {
  getPacketSenderProcess,
  startPacketSender,
  stopPacketSender,
} from "../processes/packetSender.js";
import { getBinaryPath } from "../utils/paths.js";
import { loadView } from "../windows/mainWindow.js";

/**
 * Creates and sets the application menu with File, View, Tools, and Help sections.
 * Includes menu items for reloading, exiting, switching views, toggling DevTools, and managing packet sender.
 * @param {import("electron").BrowserWindow} mainWindow - The main browser window instance to attach menu actions to.
 * @returns {void}
 * @example
 * createMenu(mainWindow);
 */
function createMenu(mainWindow) {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: (_, browserWindow) => {
            if (browserWindow) {
              browserWindow.reload();
            }
          },
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
          label: "Competition View",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            loadView("competition-view");
          },
        },
        {
          label: "Testing View",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            loadView("testing-view");
          },
        },
        { type: "separator" },
        {
          label: "Toggle DevTools",
          accelerator: "F12",
          click: (_, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.toggleDevTools();
            }
          },
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
              startPacketSender();
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
              detail: `Version ${app.getVersion()}\n\nControl and monitoring software for Hyperloop pod.`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  return menu;
}

export { createMenu };
