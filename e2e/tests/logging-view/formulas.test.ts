import { expect, test, type Page } from "@playwright/test";

// velocity = 0, 2, 1 · position = 1, 3, 2 · temperature = 2, 4, 3, all sampled
// at the same three instants.
async function openSession(page: Page) {
  await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    await useStore.getState().openSession(
      ["velocity", "position", "temperature"].map((name, index) => ({
        name: `${name}.csv`,
        webkitRelativePath: `demo/data/LCU/${name}.csv`,
        text: async () =>
          `0,LCU,backend,${index}\n50000,LCU,backend,${index + 2}\n100000,LCU,backend,${index + 1}`,
      })),
    );
  });
}

async function plotSignals(page: Page, names: string[]) {
  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const board = sidebar.getByRole("button", { name: /^LCU/ });
  if ((await board.getAttribute("data-state")) !== "open") await board.click();
  for (const name of names)
    await sidebar.getByText(name, { exact: true }).click();
  await pane(page).click({ button: "right" });
  await page
    .getByRole("menu", { name: "Chart 1 actions" })
    .getByRole("menuitem", { name: /^Add \d+ selected measurements?$/ })
    .click();
}

const pane = (page: Page, number = 1) =>
  page.getByRole("region", { name: `Chart panel ${number}`, exact: true });

const statistics = (page: Page) =>
  page.getByRole("region", { name: "Visible window statistics" });

const formulaRow = (page: Page, name: string) =>
  statistics(page).getByRole("row").filter({ hasText: name });

async function openMathMenu(page: Page) {
  await page.getByRole("button", { name: "Formula signals" }).click();
  return page.getByRole("menu");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/#/normal");
  await expect(
    page.getByRole("heading", { name: "Open a logging session" }),
  ).toBeVisible();
  await openSession(page);
  await plotSignals(page, ["velocity", "position"]);
});

test("a formula built from a plot is drawn, measured, edited and deleted", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Configure chart 1" }).click();
  await page
    .getByRole("button", { name: "New formula from this plot…" })
    .click();
  const dialog = page.getByRole("dialog", { name: "New formula" });
  // Both plotted signals arrive bound to a and b with a starting expression.
  await expect(dialog.getByLabel("Expression")).toHaveValue("a - b");
  await dialog.getByLabel("Expression").fill("abs(a - b) * 5");
  await dialog.getByLabel("Name", { exact: true }).fill("Gap");
  await dialog.getByRole("button", { name: "Create formula" }).click();
  await expect(dialog).toBeHidden();

  await expect(
    pane(page).getByRole("button", { name: /Math \/ Gap/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Plot overlays" }).click();
  await page
    .getByRole("menuitemcheckbox", { name: "Window statistics" })
    .click();
  await page.keyboard.press("Escape");
  // |velocity - position| is 1 at every sample.
  await expect(formulaRow(page, "Gap")).toContainText("5");
  await expect(formulaRow(page, "Gap")).not.toContainText("10");

  // Editing keeps the signal in its plot and recomputes it.
  await pane(page)
    .getByRole("button", { name: /Math \/ Gap/ })
    .click({
      button: "right",
    });
  await page.getByRole("menuitem", { name: "Edit formula…" }).click();
  const editor = page.getByRole("dialog", { name: "Edit formula" });
  await editor.getByLabel("Expression").fill("abs(a - b) * 10");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(formulaRow(page, "Gap")).toContainText("10");

  const menu = await openMathMenu(page);
  await menu.getByRole("menuitem", { name: /Gap/ }).click();
  await page.getByRole("menuitem", { name: "Delete formula" }).click();
  await expect(
    pane(page).getByRole("button", { name: /Math \/ Gap/ }),
  ).toHaveCount(0);
  await expect(
    pane(page).getByRole("button", { name: /LCU \/ velocity/ }),
  ).toBeVisible();
});

test("the editor refuses expressions it cannot evaluate", async ({ page }) => {
  const menu = await openMathMenu(page);
  await menu.getByRole("menuitem", { name: "New formula…" }).click();
  const dialog = page.getByRole("dialog", { name: "New formula" });
  const expression = dialog.getByLabel("Expression");
  const create = dialog.getByRole("button", { name: "Create formula" });
  await expect(create).toBeDisabled();

  await expression.fill("a +");
  await expect(dialog.getByRole("status")).toHaveText(
    "The expression ends too early",
  );
  await expression.fill("a + q");
  await expect(dialog.getByRole("status")).toHaveText(
    '"q" is not one of the variables above',
  );
  // Syntactically fine, but `a` has no measurement yet.
  await expression.fill("a * 2");
  await expect(dialog.getByRole("status")).toHaveText(
    'Choose a measurement for "a"',
  );
  await expect(create).toBeDisabled();

  await dialog.getByRole("button", { name: "Measurement for a" }).click();
  // A single board skips the board step and lands on its measurements.
  await page.getByPlaceholder("Filter…").fill("temp");
  await page.getByRole("button", { name: "temperature", exact: true }).click();
  await expect(create).toBeEnabled();
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "A new plot" }).click();
  await create.click();

  // The source was not plotted anywhere; it is loaded for the formula alone.
  await expect(
    pane(page, 2).getByRole("button", { name: /Math \/ Formula 1/ }),
  ).toBeVisible();
});

test("the measurement picker goes board first and its list scrolls", async ({
  page,
}) => {
  // Two boards, one with far more measurements than fit in the list.
  await page.evaluate(async () => {
    const modulePath = "/src/store/store.ts";
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    const file = (board: string, name: string) => ({
      name: `${name}.csv`,
      webkitRelativePath: `demo/data/${board}/${name}.csv`,
      text: async () => `0,${board},backend,1\n50000,${board},backend,2`,
    });
    await useStore
      .getState()
      .openSession([
        file("LCU", "velocity"),
        ...Array.from({ length: 40 }, (_, index) =>
          file("BMS", `cell_${String(index).padStart(2, "0")}`),
        ),
      ]);
  });
  const menu = await openMathMenu(page);
  await menu.getByRole("menuitem", { name: "New formula…" }).click();
  const dialog = page.getByRole("dialog", { name: "New formula" });
  await dialog.getByRole("button", { name: "Measurement for a" }).click();
  await page.getByRole("button", { name: /^BMS/ }).click();

  const last = page.getByRole("button", { name: "cell_39", exact: true });
  await expect(last).not.toBeInViewport();
  await page.getByRole("button", { name: "cell_02", exact: true }).hover();
  await page.mouse.wheel(0, 2000);
  await expect(last).toBeInViewport();
  await last.click();
  await expect(
    dialog.getByRole("button", { name: "Measurement for a" }),
  ).toHaveText("BMS/cell_39");
});
