import { EventEmitter } from "node:events";
import { app, BrowserWindow, dialog, screen } from "electron";
import fs from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import {
  createCompetitionWindow,
  createTestingWindow,
} from "../additionalViewWindow.js";
import { createWindow, getCurrentView, getMainWindow } from "../mainWindow.js";
import { setWindowMenu } from "../../menu/menu.js";

vi.mock("electron", () => ({
  app: { isPackaged: true, quit: vi.fn() },
  Menu: { buildFromTemplate: vi.fn() },
  dialog: { showErrorBox: vi.fn() },
  screen: {
    getPrimaryDisplay: () => ({
      workAreaSize: { width: 1600, height: 1000 },
      workArea: { x: 0, y: 0 },
    }),
    getDisplayMatching: vi.fn(() => ({
      workAreaSize: { width: 1600, height: 1000 },
      workArea: { x: 1600, y: 0 },
    })),
  },
  BrowserWindow: vi.fn(function () {
    const window = new EventEmitter();
    window.webContents = new EventEmitter();
    window.loadFile = vi.fn().mockResolvedValue(undefined);
    window.setTitle = vi.fn();
    window.show = vi.fn();
    window.focus = vi.fn();
    window.isDestroyed = () => false;
    window.getBounds = () => ({ x: 1700, y: 0, width: 1280, height: 800 });
    window.close = vi.fn(() => {
      window.emit("close");
      window.emit("closed");
    });
    return window;
  }),
}));
vi.mock("node:fs", () => ({ default: { existsSync: vi.fn() } }));
vi.mock("fs", () => ({ default: { existsSync: vi.fn(() => true) } }));
vi.mock("../../utils/paths.js", () => ({ getAppPath: () => "/app" }));
vi.mock("../../menu/menu.js", () => ({ setWindowMenu: vi.fn() }));
vi.mock("../aboutWindow.js", () => ({ showAboutWindow: vi.fn() }));
vi.mock("../../utils/logger.js", () => ({
  logger: { electron: { error: vi.fn() } },
}));

beforeEach(() => {
  getMainWindow()?.emit("closed");
  vi.clearAllMocks();
  fs.existsSync.mockReturnValue(true);
});

it("opens the packaged Testing renderer without replacing the main view", async () => {
  const main = createWindow(1600, 1000, "competition-view");
  const extra = await createTestingWindow(main);
  expect(extra).not.toBe(main);
  expect(getMainWindow()).toBe(main);
  expect(getCurrentView()).toBe("competition-view");
  expect(extra.loadFile).toHaveBeenCalledWith(
    "/app/renderer/testing-view/index.html",
  );
  expect(setWindowMenu).toHaveBeenCalledWith(extra);
  expect(extra.show).toHaveBeenCalledOnce();
  expect(extra.focus).toHaveBeenCalledOnce();
  expect(screen.getDisplayMatching).toHaveBeenCalledWith(main.getBounds());
  expect(BrowserWindow.mock.calls[1][0]).toMatchObject({
    x: 1760,
    y: 100,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: "/app/preload.js",
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
});

it("allows several extra windows and closing one does not quit the app", async () => {
  const main = createWindow(1600, 1000, "testing-view");
  const first = await createTestingWindow();
  const second = await createTestingWindow();
  expect(first).not.toBe(second);
  first.close();
  expect(app.quit).not.toHaveBeenCalled();
  expect(getMainWindow()).toBe(main);
  expect(second.close).not.toHaveBeenCalled();
  second.close();
});

it("opens another Competition renderer without replacing the main window or Testing windows", async () => {
  const main = createWindow(1600, 1000, "competition-view");
  const testing = await createTestingWindow(main);
  const competition = await createCompetitionWindow(main);
  expect(competition).not.toBe(testing);
  expect(competition.loadFile).toHaveBeenCalledWith(
    "/app/renderer/competition-view/index.html",
  );
  expect(BrowserWindow.mock.calls[2][0].title).toBe(
    "Hyperloop Control Station - Competition View",
  );
  expect(getMainWindow()).toBe(main);
  expect(getCurrentView()).toBe("competition-view");
  competition.close();
  expect(testing.close).not.toHaveBeenCalled();
  expect(app.quit).not.toHaveBeenCalled();
});

it("does not open Competition when its renderer is not packaged", async () => {
  fs.existsSync.mockReturnValue(false);
  expect(await createCompetitionWindow()).toBeNull();
  expect(BrowserWindow).not.toHaveBeenCalled();
});

it("does not create an empty window if Testing View is not packaged", async () => {
  fs.existsSync.mockReturnValue(false);
  expect(await createTestingWindow()).toBeNull();
  expect(BrowserWindow).not.toHaveBeenCalled();
});

it("closes only the failed extra window if its page cannot load", async () => {
  const main = createWindow(1600, 1000, null);
  BrowserWindow.mockImplementationOnce(function () {
    const window = new EventEmitter();
    window.loadFile = vi
      .fn()
      .mockRejectedValue(new Error("Unable to load view"));
    window.isDestroyed = () => false;
    window.close = vi.fn(() => window.emit("closed"));
    return window;
  });
  expect(await createTestingWindow()).toBeNull();
  expect(app.quit).not.toHaveBeenCalled();
  expect(getMainWindow()).toBe(main);
  expect(dialog.showErrorBox).toHaveBeenCalledWith(
    "Could Not Open Testing View",
    "Unable to load view",
  );
});

it("does not report an error when the extra window closes while loading", async () => {
  BrowserWindow.mockImplementationOnce(function () {
    const window = new EventEmitter();
    window.isDestroyed = () => true;
    window.loadFile = vi.fn(async () => {
      window.emit("closed");
      throw new Error("Navigation aborted because the window closed");
    });
    return window;
  });
  expect(await createTestingWindow()).toBeNull();
  expect(dialog.showErrorBox).not.toHaveBeenCalled();
  expect(app.quit).not.toHaveBeenCalled();
});
