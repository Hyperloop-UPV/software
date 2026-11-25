import {
  _electron as electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import path from "path";
import os from "node:os";
import { access, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ELECTRON_APP_PATH = path.resolve(__dirname, "../../electron-app");

function findWindow(app: ElectronApplication, pathname: string) {
  return app.windows().find((page) => {
    return !page.isClosed() && new URL(page.url()).pathname.endsWith(pathname);
  });
}

async function waitForWindow(app: ElectronApplication, pathname: string) {
  // Windows can be created before they navigate, or before a fixture subscribes.
  await expect
    .poll(() => Boolean(findWindow(app, pathname)), { timeout: 15_000 })
    .toBe(true);
  return findWindow(app, pathname)!;
}

type ElectronFixtures = {
  app: ElectronApplication;
  page: Page;
  logPage: Page;
};

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use) => {
    for (const mode of (process.env.E2E_REQUIRED_VIEWS ?? "testing").split(
      ",",
    )) {
      await access(
        path.join(
          ELECTRON_APP_PATH,
          "renderer",
          `${mode.trim()}-view`,
          "index.html",
        ),
      );
    }
    const profile = await mkdtemp(
      path.join(os.tmpdir(), "control-station-e2e-"),
    );
    const app = await electron
      .launch({
        args: ["--no-sandbox", path.join(__dirname, "electron-main.cjs")],
        cwd: ELECTRON_APP_PATH,
        env: {
          ...process.env,
          NODE_ENV: "test",
          CONTROL_STATION_E2E_PROFILE: profile,
        },
      })
      .catch(async (error) => {
        await rm(profile, { recursive: true, force: true, maxRetries: 5 });
        throw error;
      });

    try {
      // A build containing only Testing View selects it automatically. Otherwise
      // enter through the same mode selector button used during normal startup.
      await expect
        .poll(
          async () => {
            if (findWindow(app, "/testing-view/index.html")) return true;

            const selector = findWindow(app, "/mode-selector/index.html");
            if (!selector) return false;
            try {
              if ((await selector.locator("#button-grid button").count()) > 1) {
                await selector
                  .getByRole("button", { name: "Testing View", exact: true })
                  .click();
                return true;
              }
            } catch (error) {
              // Single-view builds close the selector automatically. It can
              // disappear during any awaited locator call, including click.
              // Retry discovery so the Testing View window confirms startup.
              if (!selector.isClosed()) throw error;
            }
            return false;
          },
          { timeout: 15_000 },
        )
        .toBe(true);

      await waitForWindow(app, "/testing-view/index.html");
      await waitForWindow(app, "/log-viewer/index.html");
      await use(app);
    } finally {
      try {
        await app.close();
      } finally {
        await rm(profile, { recursive: true, force: true, maxRetries: 5 });
      }
    }
  },

  // Locate windows by their loaded view, independently of creation order.
  logPage: async ({ app }, use) => {
    const page = await waitForWindow(app, "/log-viewer/index.html");
    await page.waitForLoadState("domcontentloaded");
    await use(page);
  },

  // Interactive tests require the real backend, not a terminal error/mock state.
  page: async ({ app }, use) => {
    const page = await waitForWindow(app, "/testing-view/index.html");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("mode-badge")).toHaveAttribute(
      "data-mode",
      "active",
      { timeout: 15_000 },
    );
    await use(page);
  },
});

export { expect } from "@playwright/test";
