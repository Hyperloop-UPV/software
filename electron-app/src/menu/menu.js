/**
 * @module menu
 * @description Application menu creation and management for the Electron application.
 * Defines menu structure with File, Tools, and Help sections with keyboard shortcuts and actions.
 */

import { Menu, app, dialog } from "electron";

/**
 * Creates and sets the application menu with File, Tools, and Help sections.
 * Includes menu items for reloading, exiting, toggling DevTools, and app information.
 * View switching is no longer available since the mode is selected at startup.
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
      label: "Tools",
      submenu: [
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
