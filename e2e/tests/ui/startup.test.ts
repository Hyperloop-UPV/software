import { expect, test } from "../../fixtures/electron";

test("backend logs window opens with correct title", async ({ logPage }) => {
  await expect(logPage).toHaveTitle("Backend Logs");
  await logPage.waitForTimeout(6000);
  console.log("Backend logs:", await logPage.content());
});

test("control station window opens with correct title", async ({ page }) => {
  await expect(page).toHaveTitle("Hyperloop Testing View");
});
