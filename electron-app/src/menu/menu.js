/**
 * @module menu
 * @description Application menu creation and management for the Electron application.
 * Defines window menus and shortcuts for navigating the Control Station.
 */

import { BrowserWindow, Menu, app } from "electron";
import fs from "fs";
import path from "path";
import { getAppPath } from "../utils/paths.js";
import { showAboutWindow } from "../windows/aboutWindow.js";
import { getCurrentView, getMainWindow } from "../windows/mainWindow.js";
import { showLogWindow } from "../windows/logWindow.js";
import { checkForUpdates } from "../app/updater.js";
import { openAppLocation, openProjectLink } from "./toolActions.js";

/**
 * Creates the Control Station menu, or the original File menu for the selector.
 * Only views included in the installed build are offered as destinations.
 * @returns {Menu} The built application menu.
 * @example
 * Menu.setApplicationMenu(createMenu());
 */
function createMenu({ isSelector = false } = {}) {
  const views = [
    { mode: "testing", label: "Testing View" },
    { mode: "competition", label: "Competition View" },
    { mode: "flashing", label: "Flashing View" },
    { mode: "logging", label: "Logging View" },
    { mode: "adj", label: "ADJ Viewer" },
  ];
  const viewItems = isSelector
    ? []
    : views
        .filter(({ mode }) =>
          fs.existsSync(
            path.join(getAppPath(), "renderer", `${mode}-view`, "index.html"),
          ),
        )
        .map(({ mode, label }) => ({
          label,
          click: () => app.emit("switch-mode", mode),
        }));

  const template = [
    {
      label: isSelector ? "File" : "Control Station",
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
        ...(viewItems.length
          ? [{ type: "separator" }, ...viewItems, { type: "separator" }]
          : []),
        {
          label: "Return to Selector",
          accelerator: "CmdOrCtrl+Shift+S",
          enabled: !isSelector,
          click: () => app.emit("return-to-selector"),
        },
        { type: "separator" },
        {
          label: isSelector ? "Exit" : "Quit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    ...(!isSelector
      ? [
          {
            label: "Edit",
            submenu: [
              { role: "undo", label: "Undo" },
              { role: "redo", label: "Redo" },
              { type: "separator" },
              { role: "cut", label: "Cut" },
              { role: "copy", label: "Copy" },
              { role: "paste", label: "Paste" },
            ],
          },
        ]
      : []),
    {
      label: isSelector ? "Tools" : "View",
      submenu: [
        ...(!isSelector
          ? [{ role: "reload", label: "Reload" }, { type: "separator" }]
          : []),
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { role: "resetZoom", label: "Reset Zoom" },
        { type: "separator" },
        {
          label: "Toggle Full Screen",
          accelerator: "F11",
          click: (_, browserWindow) => {
            if (browserWindow) {
              browserWindow.setFullScreen(!browserWindow.isFullScreen());
            }
          },
        },
        ...(isSelector
          ? [
              {
                role: "toggleDevTools",
                label: "Toggle DevTools",
                accelerator: "F12",
              },
            ]
          : [
              {
                label: "Development",
                submenu: [
                  {
                    role: "toggleDevTools",
                    label: "Toggle DevTools",
                    accelerator: "F12",
                  },
                ],
              },
            ]),
      ],
    },
    ...(!isSelector
      ? [
          {
            label: "Tools",
            submenu: [
              {
                label: "Open ADJ Repository",
                click: (_, window) => openProjectLink("adj", window),
              },
              { type: "separator" },
              ...[
                { label: "Open App Cache Folder", location: "cache" },
                { label: "Open Settings Folder", location: "settings" },
                { label: "Open Logger Folder", location: "logger" },
                { label: "Open config.toml", location: "config" },
                { label: "Open ADJ Folder", location: "adj" },
              ].map(({ label, location }) => ({
                label,
                click: (_, window) => openAppLocation(location, window),
              })),
            ],
          },
        ]
      : []),
    ...(!isSelector
      ? [
          {
            label: "Window",
            submenu: [
              {
                label: "Show Main Window",
                click: () => {
                  const window = getMainWindow();
                  if (!window || window.isDestroyed()) return;
                  if (window.isMinimized()) window.restore();
                  window.show();
                  window.focus();
                },
              },
              {
                id: "show-backend-logs",
                label: "Show Backend Logs",
                enabled: hasBackendView(),
                click: () => {
                  if (hasBackendView()) showLogWindow();
                },
              },
              {
                id: "new-competition-window",
                label: "New Competition Window",
                visible: canOpenCompetitionWindow(),
                enabled: canOpenCompetitionWindow(),
                click: () => {
                  if (canOpenCompetitionWindow())
                    app.emit("new-competition-window");
                },
              },
              {
                id: "new-testing-window",
                label: "New Testing Window",
                visible: canOpenTestingWindow(),
                enabled: canOpenTestingWindow(),
                click: () => {
                  if (canOpenTestingWindow()) app.emit("new-testing-window");
                },
              },
              { type: "separator" },
              { role: "minimize", label: "Minimize" },
            ],
          },
        ]
      : []),
    {
      label: "Help",
      submenu: [
        {
          label: isSelector ? "About" : "About Control Station",
          click: (_, window) =>
            showAboutWindow(window ?? BrowserWindow.getFocusedWindow()),
        },
        ...(!isSelector
          ? [
              {
                label: "Check for Updates...",
                click: (_, window) =>
                  checkForUpdates(window ?? BrowserWindow.getFocusedWindow()),
              },
              { type: "separator" },
              {
                label: "Report an Issue...",
                click: (_, window) => openProjectLink("issue", window),
              },
            ]
          : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  if (!isSelector) {
    // Menus outlive view changes, so refresh availability whenever Window opens.
    const windowMenu = menu.items.find(
      (item) => item.label === "Window",
    ).submenu;
    windowMenu.on("menu-will-show", () => {
      menu.getMenuItemById("show-backend-logs").enabled = hasBackendView();
      const newWindow = menu.getMenuItemById("new-testing-window");
      newWindow.visible = canOpenTestingWindow();
      newWindow.enabled = newWindow.visible;
      const newCompetitionWindow = menu.getMenuItemById(
        "new-competition-window",
      );
      newCompetitionWindow.visible = canOpenCompetitionWindow();
      newCompetitionWindow.enabled = newCompetitionWindow.visible;
    });
  }
  return menu;
}

function hasBackendView() {
  return ["testing-view", "competition-view"].includes(getCurrentView());
}

function canOpenTestingWindow() {
  return (
    hasBackendView() &&
    fs.existsSync(
      path.join(getAppPath(), "renderer", "testing-view", "index.html"),
    )
  );
}

function canOpenCompetitionWindow() {
  return (
    getCurrentView() === "competition-view" &&
    fs.existsSync(
      path.join(getAppPath(), "renderer", "competition-view", "index.html"),
    )
  );
}

/** Assign a menu to a window; macOS uses the focused window's application menu. */
function setWindowMenu(window, options) {
  const menu = createMenu(options);
  if (process.platform === "darwin") {
    window.on("focus", () => Menu.setApplicationMenu(menu));
    if (window.isFocused()) Menu.setApplicationMenu(menu);
  } else {
    window.setMenu(menu);
  }
}

export { createMenu, setWindowMenu };
