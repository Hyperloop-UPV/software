# e2e

End-to-end tests for the whole app. Tests run against the real Electron application using **Playwright** with the `@playwright/test` electron driver.

---

## Overview

Tests are split into two Playwright projects:

| Project       | Directory        | Description                                                   |
| :------------ | :--------------- | :------------------------------------------------------------ |
| `ui`          | `tests/ui/`      | UI tests — launch the Electron app and interact with the UI   |
| `integration` | `tests/integration/` | Integration tests (reserved for future use)               |

---

## UI Tests

These tests launch the full Electron app and drive it through Playwright. They cover app startup, window titles, mode badge state, chart interactions, and filter dialog behaviour.

---

## Fixtures

`fixtures/electron.ts` provides three custom Playwright fixtures:

| Fixture    | Description                                                         |
| :--------- | :------------------------------------------------------------------ |
| `app`      | Launches the Electron app and waits for both windows to be ready    |
| `page`     | The main Control Station window — waits for the app to leave loading state |
| `logPage`  | The Backend Logs window                                             |

---

## Scripts

| Script                 | Description                                                       |
| :--------------------- | :---------------------------------------------------------------- |
| `pnpm test`            | Build all dependencies then run all tests                         |
| `pnpm test:ui`         | Build all dependencies then run only `tests/ui`                   |
| `pnpm test:integration`| Build the electron app then run only `tests/integration`          |
| `pnpm test:fast`       | Run all tests without rebuilding (assumes already built)          |
| `pnpm test:fast:ui`    | Run `tests/ui` without rebuilding                                 |
| `pnpm report`          | Open the last Playwright HTML report                              |

> **Note:** `pnpm test` and `pnpm test:ui` always build the `testing-view` (e2e mode) and the electron app before running. Use the `:fast` variants when iterating to skip the build step.

---

## Requirements

- The `hyperloop-control-station` electron app must be built (handled automatically by `pnpm test`).
- `testing-view` must be built in e2e mode (`build:e2e`), also handled automatically.
- Workers are set to `1` — Electron tests must run serially since only one app instance can run at a time.

> **Note:** The app runs in its normal production mode during tests — there is no special test environment or mock mode.
