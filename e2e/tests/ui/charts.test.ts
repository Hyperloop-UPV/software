import { expect, test } from "../../fixtures/electron";

/** Wait for the Zustand persist middleware to rehydrate from localStorage. */
async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForSelector('html[data-store-hydrated="true"]');
  return await page.getByTestId("chart").count();
}

test("add chart button is visible in toolbar", async ({ page }) => {
  await expect(page.getByTestId("add-chart-button")).toBeVisible();
});

test("add chart button adds a chart", async ({ page }) => {
  const initialCount = await waitForHydration(page);

  await page.getByTestId("add-chart-button").click();

  await expect(page.getByTestId("chart")).toHaveCount(initialCount + 1);
});

test("clicking add chart multiple times adds multiple charts", async ({
  page,
}) => {
  const initialCount = await waitForHydration(page);

  await page.getByTestId("add-chart-button").click();
  await page.getByTestId("add-chart-button").click();
  await page.getByTestId("add-chart-button").click();

  await expect(page.getByTestId("chart")).toHaveCount(initialCount + 3);
});

test("charts are restored from localStorage after reload", async ({ page }) => {
  const initialCount = await waitForHydration(page);

  // Add two charts on top of whatever is already persisted
  await page.getByTestId("add-chart-button").click();
  await page.getByTestId("add-chart-button").click();
  await expect(page.getByTestId("chart")).toHaveCount(initialCount + 2);

  // Give Zustand persist time to flush to localStorage before reloading
  await page.waitForTimeout(300);

  // Reload — Zustand should restore all charts from localStorage
  await page.reload();
  await waitForHydration(page);

  await expect(page.getByTestId("chart")).toHaveCount(initialCount + 2);
});
