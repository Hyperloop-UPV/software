# Testing View

The Testing View is the web interface used during vehicle testing sessions. It provides real-time telemetry charts and a filtering system for monitoring packet data from the pod.

It is built with **React**, **TypeScript**, and **Vite**, and runs embedded inside the Hyperloop Control Station Electron app.

---

## Features

### Workspaces

Workspaces are named tabs that each hold their own independent set of charts. You can create, rename, and delete workspaces, and switch between them at any time. The active workspace and its charts are persisted across sessions.

### Charts

The charts panel displays live telemetry data as line charts within the active workspace. You can add, remove, and reorder charts via drag and drop. Each chart supports multiple data series and a configurable history limit that controls how many data points are kept in memory.

### Filtering

The filtering system lets you select which telemetry packets and commands are visible. Filters are organized in a tree matching the packet catalog structure, with search, select all, and clear all controls.

### Settings

A settings dialog exposes runtime configuration for the vehicle connection, including vehicle board selection, ADJ branch, TCP/TFTP connection parameters, BLCU addresses, and logging options (time unit and output path).

### Key Bindings

The key bindings system lets you assign keyboard shortcuts to commands sent to the vehicle, as well as special built-in actions like starting, stopping, or toggling the logger.

---

## Scripts

| Script            | Description                                     |
| :---------------- | :---------------------------------------------- |
| `pnpm dev`        | Start the Vite dev server                       |
| `pnpm build`      | Type-check and build for production             |
| `pnpm build:e2e`  | Build in e2e mode (used by the `e2e` workspace) |
| `pnpm preview`    | Preview the production build                    |
| `pnpm lint`       | Run ESLint                                      |
| `pnpm test`       | Run unit tests once (Vitest)                    |
| `pnpm test:watch` | Run unit tests in watch mode                    |

---

## Tests

Unit tests are written with **Vitest**. The charts store, filtering store, and utility functions are covered.
