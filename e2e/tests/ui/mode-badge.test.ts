import { expect, test } from "../../fixtures/electron";

const VALID_MODES = ["mock", "active", "mock-active", "loading", "error"];

test("mode badge is visible with a valid mode", async ({ page }) => {
  const badge = page.getByTestId("mode-badge");
  await expect(badge).toBeVisible();

  const mode = await badge.getAttribute("data-mode");
  expect(VALID_MODES).toContain(mode);
});

test("mode badge reaches active mode", async ({ page }) => {
  await expect(page.getByTestId("mode-badge")).toHaveAttribute(
    "data-mode",
    "active",
  );
});

