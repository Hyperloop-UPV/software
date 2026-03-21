import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ELECTRON_APP_PATH = path.resolve(__dirname, "../../electron-app");

type ElectronFixtures = {
  app: ElectronApplication;
  page: Page;
  logPage: Page;
};

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use) => {
    const app = await electron.launch({
      args: ["--no-sandbox", path.join(ELECTRON_APP_PATH, "main.js")],
      cwd: ELECTRON_APP_PATH,
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    // Wait for both windows to open before yielding the app fixture,
    // so logPage and logWindow fixtures can safely index into app.windows()
    await app.firstWindow();           // Backend Logs — always first
    await app.waitForEvent("window");  // Control Station — always second

    await use(app);
    await app.close();
  },

  // Backend logs window — always opens first
  logPage: async ({ app }, use) => {
    const page = app.windows()[0];
    await page.waitForLoadState("domcontentloaded");
    await use(page);
  },

  // Main control station window — always opens second
  // Waits for the app to reach "active" mode before yielding
  page: async ({ app }, use) => {
    const page = app.windows()[1];
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector('[data-testid="mode-badge"]:not([data-mode="loading"])', { timeout: 15000 });
    console.log("[mode]", await page.getAttribute('[data-testid="mode-badge"]', "data-mode"));
    await use(page);
  },
});

export { expect } from "@playwright/test";
