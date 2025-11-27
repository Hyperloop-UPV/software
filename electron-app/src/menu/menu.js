const { Menu, dialog, app } = require("electron");
const { getBinaryPath } = require("../utils/paths");
const {
  startPacketSender,
  getPacketSenderProcess,
} = require("../processes/packetSender");
const fs = require("fs");

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
            const { loadView } = require("../windows/mainWindow");
            loadView("control-station");
          },
        },
        {
          label: "Ethernet View",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            const { loadView } = require("../windows/mainWindow");
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
            const { stopPacketSender } = require("../processes/packetSender");
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

module.exports = { createMenu };
