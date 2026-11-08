import { expect, test } from "../../fixtures/electron";

test("backend logs window opens with correct title", async ({ logPage }) => {
  await expect(logPage).toHaveTitle("Backend Logs");
});

test("control station window opens with correct title", async ({ page }) => {
  await expect(page).toHaveTitle("Hyperloop Testing View");
});

test("selecting Testing View closes the selector and opens its windows", async ({
  app,
  page,
  logPage,
}) => {
  await expect(page).toHaveURL(/\/testing-view\/index\.html$/);
  await expect(logPage).toHaveURL(/\/log-viewer\/index\.html$/);
  await expect
    .poll(() =>
      app
        .windows()
        .some((window) => window.url().includes("/mode-selector/index.html")),
    )
    .toBe(false);
});
