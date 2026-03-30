import { expect, test } from "../../fixtures/electron";

test("backend logs window opens with correct title", async ({ logPage }) => {
  await expect(logPage).toHaveTitle("Backend Logs");
});

test("control station window opens with correct title", async ({ page }) => {
  await expect(page).toHaveTitle("Hyperloop Testing View");
});
