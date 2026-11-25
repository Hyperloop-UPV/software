# e2e

End-to-end tests for the whole app. Tests run against the real Electron application using **Playwright** with the `@playwright/test` electron driver.

---

## Overview

Tests are split into two Playwright projects:

| Project       | Directory            | Description                                                                             |
| :------------ | :------------------- | :-------------------------------------------------------------------------------------- |
| `ui`          | `tests/ui/`          | UI tests — launch the Electron app and interact with the UI                             |
| `integration` | `tests/integration/` | Real renderer/main IPC, Go HTTP catalogs, WebSocket subscriptions and profile isolation |

---

## UI Tests

These tests launch the full Electron app and cover startup, menus, additional Testing/Competition windows, About, charts and filters. Filter tests assert checkbox state after selecting/clearing, and exercise Escape and overlay clicks separately. Tests for the removed Backend menu controls have been retired; those controls are not restored by this suite.

---

## Fixtures

`fixtures/electron.ts` provides three custom Playwright fixtures:

| Fixture   | Description                                                                                      |
| :-------- | :----------------------------------------------------------------------------------------------- |
| `app`     | Launches Electron, selects Testing View, and waits for the Testing View and Backend Logs windows |
| `page`    | The main Testing window — waits for the real backend's `active` mode                             |
| `logPage` | The Backend Logs window                                                                          |

The fixture clicks **Testing View** on the startup mode selector. Builds containing
only Testing View skip the selector automatically, which the fixture also supports.
Windows are located by their loaded URL, not their creation order. Electron is
closed even if startup or a test fails.

Each test gets a fresh temporary `userData` directory through the test-only
`fixtures/electron-main.cjs` bootstrap. It is removed after Electron closes,
including failures. Preferences and `localStorage` do not leak between cases or
into a developer's profile; persistence within one test remains testable.
The normal Electron entry point and Go sources are unchanged. Tests still use the
development configuration and existing backend/ADJ installation; they never send
vehicle commands. The WebSocket integration test only subscribes to connection state.

---

## Scripts

| Script                       | Description                                                           |
| :--------------------------- | :-------------------------------------------------------------------- |
| `pnpm build`                 | Build/copy Testing (e2e mode), Competition, Logging and ADJ renderers |
| `pnpm test`                  | Build those renderers then run UI and integration tests               |
| `pnpm test:ui`               | Build those renderers then run only `tests/ui`                        |
| `pnpm test:integration`      | Build those renderers then run the integration project                |
| `pnpm test:fast`             | Run all tests without rebuilding (assumes already built)              |
| `pnpm test:fast:ui`          | Run `tests/ui` without rebuilding                                     |
| `pnpm test:fast:integration` | Run integration tests without rebuilding                              |
| `pnpm report`                | Open the last Playwright HTML report                                  |

The renderer build does not compile Go or package Electron. It copies each
frontend once, preserving Testing's E2E build rather than rebuilding it in normal mode.
Use `:fast` variants when iterating against already-built renderers.

---

## Requirements

- A platform-appropriate, prebuilt backend binary must exist in `electron-app/binaries/`. CI builds it before running the suite.
- `testing-view` must be built in e2e mode (`build:e2e`), also handled automatically.
- Workers are set to `1` — Electron tests must run serially since only one app instance can run at a time.

CI builds all four tested views and runs both projects. `E2E_REQUIRED_VIEWS=testing,competition,logging,adj` makes missing CI build artifacts a failure instead of silently skipping cross-view tests. Fast local runs may still skip optional-view cases when testing a reduced build.

Renderers use the real backend, not mock mode. `NODE_ENV=test` only suppresses
automatic DevTools in Electron. Run the suite without another Control Station
backend using the same fixed ports.
