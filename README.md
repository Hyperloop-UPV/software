# Hyperloop Control Station H11

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

| Workspace                      | Language | Description                                    |
| :----------------------------- | :------- | :--------------------------------------------- |
| `testing-view`                 | TS/React | Web interface for telemetry testing            |
| `competition-view`             | TS/React | UI for the competition                         |
| `backend`                      | Go       | Data ingestion and pod communication server    |
| `packet-sender`                | Rust     | Utility for simulating vehicle packets         |
| `electron-app`                 | JS       | The main Control Station desktop application   |
| `@workspace/ui`                | TS/React | Shared UI component library (frontend-kit)     |
| `@workspace/core`              | TS       | Shared business logic and types (frontend-kit) |
| `@workspace/eslint-config`     | ESLint   | Common ESLint configuration (frontend-kit)     |
| `@workspace/typescript-config` | TS       | Common TypeScript configuration (frontend-kit) |

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
- `pnpm test` – Runs all test suites across the repo (Vitest, Go tests, and Cargo tests).
- `pnpm lint` – Runs ESLint across all TypeScript packages.
- `pnpm preview` – Previews the production Vite builds for the frontend applications.
