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

for (const scope of ["telemetry", "commands"]) {
  test(`${scope} select all and clear all change the selected filters`, async ({
    page,
  }) => {
    await page.getByTestId(`filter-button-${scope}`).click();
    const dialog = page.getByTestId("filter-dialog");
    const checkboxes = dialog.getByRole("checkbox");
    await expect.poll(() => checkboxes.count()).toBeGreaterThan(0);
    const count = await checkboxes.count();
    await dialog.getByTestId("filter-select-all").click();
    await expect(
      dialog.locator('[role="checkbox"][aria-checked="true"]'),
    ).toHaveCount(count);
    await dialog.getByTestId("filter-clear-all").click();
    await expect(
      dialog.locator('[role="checkbox"][aria-checked="false"]'),
    ).toHaveCount(count);
    await expect(
      dialog.locator('[role="checkbox"][aria-checked="true"]'),
    ).toHaveCount(0);
    await dialog.getByTestId("filter-select-all").click();
    await expect(
      dialog.locator('[role="checkbox"][aria-checked="true"]'),
    ).toHaveCount(count);
    await page.keyboard.press("Escape");
    await page.getByTestId(`filter-button-${scope}`).click();
    await expect(
      dialog.locator('[role="checkbox"][aria-checked="true"]'),
    ).toHaveCount(count);
  });
}

test("filter dialog closes on Escape", async ({ page }) => {
  await page.getByTestId("filter-button-telemetry").click();

  const dialog = page.getByTestId("filter-dialog");
  await expect(dialog).toBeVisible();

  // Press Escape to close
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("filter dialog closes on an actual overlay click", async ({ page }) => {
  await page.getByTestId("filter-button-telemetry").click();
  const dialog = page.getByTestId("filter-dialog");
  await expect(dialog).toBeVisible();
  await page
    .locator('[data-slot="dialog-overlay"]')
    .click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
});
