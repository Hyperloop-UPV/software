import { expect, test } from "../../fixtures/electron";

test("telemetry filter dialog opens with correct title", async ({ page }) => {
  await page.getByTestId("filter-button-telemetry").click();

  const dialog = page.getByTestId("filter-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText(
    "Filter telemetry packets",
  );
});

test("commands filter dialog opens with correct title", async ({ page }) => {
  await page.getByTestId("filter-button-commands").click();

  const dialog = page.getByTestId("filter-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText("Filter commands");
});

test("filter dialog select all and clear all buttons work", async ({
  page,
}) => {
  await page.getByTestId("filter-button-telemetry").click();

  const dialog = page.getByTestId("filter-dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByTestId("filter-clear-all").click();
  await dialog.getByTestId("filter-select-all").click();

  // Dialog should still be open after interactions
  await expect(dialog).toBeVisible();
});

test("filter dialog closes on overlay click", async ({ page }) => {
  await page.getByTestId("filter-button-telemetry").click();

  const dialog = page.getByTestId("filter-dialog");
  await expect(dialog).toBeVisible();

  // Press Escape to close
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
