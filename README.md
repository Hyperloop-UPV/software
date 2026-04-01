# Hyperloop Control Station H11

![Testing View](https://raw.githubusercontent.com/Hyperloop-UPV/webpage/5c1c827d82d380689856ee61af43da30da22e0fc/src/assets/backgrounds/testing-view.png)

## Monorepo usage

This project implements `pnpm` workspaces and `turbo` pack to manage the development lifecycle across multiple languages and frameworks.

### Prerequisites

Before starting, ensure you have the following installed:

- **PNPM** (v10.26.0+)
- **Node.js** (v20+)
- **Go** (for the backend)
- **Rust/Cargo** (for the packet-sender)

---

### Workspaces Overview

Our `pnpm-workspace.yaml` defines the following workspaces:

| Workspace                      | Language | Description                                           |
| :----------------------------- | :------- | :---------------------------------------------------- |
| `testing-view`                 | TS/React | Web interface for telemetry testing                   |
| `competition-view`             | TS/React | UI for the competition                                |
| `backend`                      | Go       | Data ingestion and pod communication server           |
| `packet-sender`                | Rust     | Utility for simulating vehicle packets                |
| `hyperloop-control-station`    | JS       | The main Control Station electron desktop application |
| `e2e`                          | TS       | End-to-end tests for the whole app (Playwright)       |
| `@workspace/ui`                | TS/React | Shared UI component library (frontend-kit)            |
| `@workspace/core`              | TS       | Shared business logic and types (frontend-kit)        |
| `@workspace/eslint-config`     | ESLint   | Common ESLint configuration (frontend-kit)            |
| `@workspace/typescript-config` | TS       | Common TypeScript configuration (frontend-kit)        |

---

### Terminal Commands

These commands should be executed from the root directory (`/software`).

> **Note:** If you prefer to run scripts from a specific `package.json`, you can `cd` into the folder and execute them with `pnpm` without filtering.

#### Global Development Scripts

- `pnpm dev` – Runs both frontends, the backend (with `dev-config.toml`), and the packet-sender in a single terminal window.
- `pnpm dev:main` – Runs frontends and the backend using the standard `config.toml`.

#### Turbo Filtering

All Turbo scripts support filtering to target specific workspaces:

- `pnpm dev --filter testing-view` – Runs the `dev` script specifically for the Testing View.

> **! Important:** You must refer to a workspace by the `name` field defined in its local `package.json`.

#### Lifecycle Scripts

- `pnpm build` – Compiles every package in the monorepo (Go binaries, Rust crates, and Vite apps).
- `pnpm test` – Runs all test suites across the repo (Vitest, Go tests, Cargo tests, and Playwright e2e tests).
- `pnpm lint` – Runs ESLint across all TypeScript packages.
- `pnpm preview` – Previews the production Vite builds for the frontend applications.

#### Electron App Scripts

- `pnpm start` – Launches the Electron app directly (requires a prior build).
- `pnpm build:win` – Packages the Electron app for Windows.
- `pnpm build:linux` – Packages the Electron app for Linux.
- `pnpm build:mac` – Packages the Electron app for macOS.

#### Utility Scripts

- `pnpm ui:add <component-name>` - To add shadcn/ui components

  > Note: don't forget to also include it in frontend-kit/ui/src/components/shadcn/index.ts to be able to access it from @workspace/ui
