import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import { BrowserWindow, ipcMain, shell } from "electron";
import { showAboutWindow } from "../aboutWindow.js";

const mocks = vi.hoisted(() => ({
  handlers: new Map(),
  getAboutCredits: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { getVersion: () => "1.2.3" },
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }),
  },
  ipcMain: {
    handle: vi.fn((name, callback) => mocks.handlers.set(name, callback)),
  },
  shell: { openExternal: vi.fn() },
  BrowserWindow: vi.fn(function () {
    const window = new EventEmitter();
    window.webContents = new EventEmitter();
    window.webContents.mainFrame = {
      url: "file:///app/renderer/about/index.html",
    };
    window.webContents.setWindowOpenHandler = vi.fn();
    window.loadFile = vi.fn(async () => {});
    window.isDestroyed = () => false;
    window.isMinimized = () => false;
    window.focus = vi.fn();
    return window;
  }),
}));
vi.mock("../../about/githubCredits.js", () => ({
  getAboutCredits: mocks.getAboutCredits,
}));
vi.mock("../../utils/paths.js", () => ({ getAppPath: () => "/app" }));
vi.mock("../../menu/menu.js", () => ({ setWindowMenu: vi.fn() }));

beforeEach(() => {
  BrowserWindow.mock.results.at(-1)?.value.emit("closed");
  vi.clearAllMocks();
  mocks.getAboutCredits.mockReturnValue({
    contributors: [
      { id: "1", login: "teammate" },
      { id: "2", login: null },
    ],
  });
});
function sender(window) {
  return {
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  };
}
function open() {
  showAboutWindow();
  return BrowserWindow.mock.results.at(-1).value;
}

it("opens a compact, sandboxed About with bundled credits and the version", async () => {
  const window = open();
  expect(BrowserWindow.mock.calls[0][0]).toMatchObject({
    width: 700,
    height: 800,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: "/app/src/windows/aboutPreload.cjs",
    },
  });
  expect(
    (await mocks.handlers.get("about:credits")(sender(window))).version,
  ).toBe("1.2.3");
  expect(mocks.getAboutCredits).toHaveBeenCalledWith();
  expect(ipcMain.handle).toHaveBeenCalledTimes(2);
});

it("reuses its window and creates a fresh one after closing", () => {
  const window = open();
  showAboutWindow();
  expect(BrowserWindow).toHaveBeenCalledOnce();
  expect(window.focus).toHaveBeenCalledOnce();
  window.emit("closed");
  showAboutWindow();
  expect(BrowserWindow).toHaveBeenCalledTimes(2);
});

it("rejects IPC from other windows and subframes", async () => {
  const window = open();
  const callback = mocks.handlers.get("about:credits");
  await expect(
    callback({ sender: {}, senderFrame: window.webContents.mainFrame }),
  ).rejects.toThrow("restricted");
  await expect(
    callback({ sender: window.webContents, senderFrame: {} }),
  ).rejects.toThrow("restricted");
  window.webContents.mainFrame.url = "https://example.com";
  await expect(callback(sender(window))).rejects.toThrow("restricted");
});

it("opens the contributor's profile, not history or an arbitrary URL", async () => {
  const window = open();
  const callback = (id) =>
    mocks.handlers.get("about:open-profile")(sender(window), id);
  await callback("1");
  expect(shell.openExternal).toHaveBeenCalledWith(
    "https://github.com/teammate",
  );
  await expect(callback("2")).rejects.toThrow("no GitHub profile");
  await expect(callback("https://example.com")).rejects.toThrow(
    "no GitHub profile",
  );
  await expect(callback({})).rejects.toThrow("Invalid contributor");
  expect(shell.openExternal).toHaveBeenCalledOnce();
});

it("blocks popups and in-app navigation", () => {
  const window = open();
  expect(window.webContents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({
    action: "deny",
  });
  const event = { preventDefault: vi.fn() };
  window.webContents.emit("will-navigate", event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
});
