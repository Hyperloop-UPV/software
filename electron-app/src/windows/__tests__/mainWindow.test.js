import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import { createWindow, getMainWindow, loadView } from "../mainWindow.js";

vi.mock("electron", () => ({
  app: { isPackaged: true, quit: vi.fn() },
  dialog: { showErrorBox: vi.fn() },
  Menu: { buildFromTemplate: vi.fn() },
  BrowserWindow: class extends EventEmitter {
    constructor() {
      super();
      this.webContents = new EventEmitter();
      this.loadFile = vi.fn().mockResolvedValue(undefined);
      this.setTitle = vi.fn();
      this.isDestroyed = () => false;
    }
  },
}));
vi.mock("fs", () => ({ default: { existsSync: () => true } }));
vi.mock("../../utils/paths.js", () => ({ getAppPath: () => "/app" }));
vi.mock("../../menu/menu.js", () => ({ setWindowMenu: vi.fn() }));
vi.mock("../aboutWindow.js", () => ({ showAboutWindow: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it("keeps the replacement window usable when the previous window closes", () => {
  const previous = createWindow(1280, 800, null);
  const replacement = createWindow(1280, 800, null);
  previous.emit("closed");
  expect(getMainWindow()).toBe(replacement);
  loadView("adj-view");
  expect(replacement.loadFile).toHaveBeenCalledWith(
    "/app/renderer/adj-view/index.html",
  );
  replacement.emit("closed");
  expect(getMainWindow()).toBeNull();
});
