import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import { BrowserWindow } from "electron";
import {
  appendBackendLog,
  clearLogWindow,
  createLogWindow,
  showLogWindow,
} from "../logWindow.js";

vi.mock("electron", () => ({
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1280, height: 800 } }),
  },
  BrowserWindow: vi.fn(function () {
    return new (class extends EventEmitter {
      constructor() {
        super();
        this.webContents = new EventEmitter();
        this.webContents.send = vi.fn();
        this.loadFile = vi.fn();
        this.destroyed = false;
        this.isMinimized = () => true;
        this.restore = vi.fn();
        this.show = vi.fn();
        this.focus = vi.fn();
      }
      isDestroyed() {
        return this.destroyed;
      }
      close() {
        this.destroyed = true;
        this.emit("closed");
      }
    })();
  }),
}));
vi.mock("../../utils/paths.js", () => ({ getAppPath: () => "/app" }));
vi.mock("../../menu/menu.js", () => ({ setWindowMenu: vi.fn() }));

beforeEach(() => {
  clearLogWindow();
  vi.clearAllMocks();
});

it("replays recent history and delivers new messages to the reopened window", () => {
  const previous = createLogWindow(1280, 800);
  appendBackendLog("startup");
  previous.webContents.emit("did-finish-load");
  expect(previous.webContents.send).toHaveBeenCalledWith("log", "startup");
  previous.close();
  appendBackendLog("while closed");
  const replacement = createLogWindow(1280, 800);
  expect(replacement.webContents.send).not.toHaveBeenCalled();
  replacement.webContents.emit("did-finish-load");
  appendBackendLog("live");
  expect(replacement.webContents.send.mock.calls).toEqual([
    ["log", "startup"],
    ["log", "while closed"],
    ["log", "live"],
  ]);
});

it("focuses an existing log window instead of opening duplicates", () => {
  const window = createLogWindow(1280, 800);
  showLogWindow();
  showLogWindow();
  expect(BrowserWindow).toHaveBeenCalledOnce();
  expect(window.restore).toHaveBeenCalledTimes(2);
  expect(window.focus).toHaveBeenCalledTimes(2);
});

it("caps history at 2000 entries and clears it when the backend stops", () => {
  for (let i = 0; i < 2002; i++) appendBackendLog(String(i));
  const window = createLogWindow(1280, 800);
  window.webContents.emit("did-finish-load");
  expect(window.webContents.send).toHaveBeenCalledTimes(2000);
  expect(window.webContents.send).toHaveBeenNthCalledWith(1, "log", "2");
  clearLogWindow();
  const next = createLogWindow(1280, 800);
  next.webContents.emit("did-finish-load");
  expect(next.webContents.send).not.toHaveBeenCalled();
});

it("buffers output during reload and replays it after the listener is ready", () => {
  const window = createLogWindow(1280, 800);
  window.webContents.emit("did-finish-load");
  window.webContents.emit("did-start-loading");
  appendBackendLog("during reload");
  expect(window.webContents.send).not.toHaveBeenCalled();
  window.webContents.emit("did-finish-load");
  expect(window.webContents.send).toHaveBeenCalledWith("log", "during reload");
});
