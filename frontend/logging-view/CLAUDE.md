# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Dev server on port 9003
pnpm build        # tsc -b && vite build (a chunk-size warning is expected: Plotly is large)
pnpm lint         # ESLint
pnpm preview      # Preview production build
```

From the monorepo root: `pnpm dev --filter logging-view`, `pnpm build:logging-view`, `pnpm add <package> --filter logging-view`.

> **pnpm only** — the `preinstall` hook enforces this via `only-allow`.

There is no test suite; verify with `pnpm build` and `pnpm lint`. Lint currently reports ~100 warnings, almost all from the legacy `src/base/plot_gui_web/app.js` (see below) — judge a change by whether it adds warnings in `src/` outside `base/`. For UI changes, drive the dev server with Playwright (installed for the root `e2e` workspace) and screenshot the result; a session folder must be opened through the folder picker, so real log data is needed.

## What this app is

An **offline analysis tool for backend log sessions**. The user opens a session folder written by the backend logger; the app reads its CSVs and the session's ADJ, and plots them. It has **no WebSocket or live backend connection**: the `telemetry`, `messages`, `catalog` and `connections` store slices and the `@workspace/core` dependency are leftovers from the `competition-view` scaffold and nothing reads them.

Routing is a `HashRouter` (`src/main.tsx`, needed when served from the Electron app). `/` redirects to `/simple`; `/normal` is a placeholder page ("still under development").

## Session loading (`src/store/slices/sessionSlice.ts`)

A session folder, chosen via `<input webkitdirectory>` or drag-and-drop in `FolderPickerGroup`, is expected to look like:

```
<session>/logger_settings.json          { adj_commit_hash, time_unit: "ns"|"us"|"ms"|"s", date }
<session>/data/<BOARD>/<measurementId>.csv
```

- CSVs have 4 columns: `timestamp, board, backend, value`. `parseCSV` (`src/lib/plotStudio/csv.ts`) converts timestamps to ms using `time_unit` and shifts them to start at 0. Text values (enum names, `true`/`false`) are mapped to numeric codes, using the ADJ `enumValues` when known.
- `openSession` runs in independent stages that never abort the whole load: settings → CSV scan → ADJ fetch (`https://hyperloop-upv.github.io/ADJ-Archive/storage/commit-<adj_commit_hash>.json`). The result is a `SessionStatus` of `ok` / `degraded` (no or malformed settings but CSVs found → CSV-only mode) / `error`, plus a separate ADJ status. Shown as a badge and a toast.
- Files are kept in `sessionFiles`, keyed by `webkitRelativePath`, and parsed lazily. `clearSession` also wipes all Plot Studio state derived from the session.
- The sidebar's "View ADJ" button calls `window.electronAPI.switchView("adj-view", { commit })` (typed in `src/vite-env.d.ts`); it only works inside the Electron app, which then opens `frontend/adj-view` with `?commit=`.

## Plot Studio (simple mode)

`src/components/simple/` is a React port of the legacy vanilla app in `src/base/plot_gui_web/`, which is kept as reference only: nothing imports it and it isn't built, but ESLint scans it.

- **Layout:** the left app sidebar holds the session picker and the series list (`SeriesGroup`). The right studio panel (`StudioSidebar`) works like a VS Code activity bar with one open section at a time: Plots, Composed Series, FFT settings. Only the plots area scrolls.
- **Signals:** every session series is available without a load step. `useStudioSignals` parses a CSV **in a Web Worker** (`csv.worker.ts` via `parseCSVInWorker`) the first time it's used, and caches it in `studioFiles`. Signal IDs are `"BOARD/measId"` for session series and `"op_N"` / `"tr_N"` for composed ones (math operations and transforms, `lib/plotStudio/operations.ts`, `transforms.ts`).
- **Data shape:** `SeriesData` is structure-of-arrays `Float64Array`s (time in ms from 0, value), handed to Plotly without copies. Sessions reach hundreds of thousands of points, so:
  - `PlotWrapper` downsamples with LTTB (`decimate.ts`) before rendering.
  - Stats avoid `Math.min(...arr)`-style spreads, which overflow the stack.
  - The series list is virtualized (`@tanstack/react-virtual`), with one shared `ContextMenu` per board instead of one per row. Mounting a menu per row froze the tab.
- **Plot modes:** line chart, FFT (`fft.ts`, sample-rate override in the FFT section), and "Cronograma", a Gantt-style state timeline for enum/bool signals. Eligibility comes from ADJ type metadata (`units.ts`), with a data-shape heuristic as fallback (`timeline.ts`).
- **Drag and drop:** series rows are dragged onto plot cards with dnd-kit (`useSignalDnd.ts`). The IDs travel in dnd-kit `data`, because the source (sidebar) and targets (plots) are unrelated subtrees.
- **Theming and export:** the on-screen Plotly theme follows dark mode (`plotlyTheme.ts`). Image exports always render in the light, serif "academic" theme with the current zoom range (`PlotWrapper` export code, `getExportFigure`). Trace colours are pinned to D3 Category10 (`palette.ts`), so sidebar chips and stats match the curves. The PDF report (`lib/pdfExport/`, jsPDF) exports all visible plots with an optional cover, index, statistics and annex.

## State

A single Zustand store (`src/store/store.ts`) composed of slices. The ones in use are `sessionSlice`, `plotStudioSlice` and `appSlice`. Only `isDarkMode` is persisted, under the localStorage key `competition-view-storage`; the name is a scaffold leftover, and renaming it would reset users' theme.

## Workspace dependencies

Components, icons and utilities come from `@workspace/ui` (`frontend-kit/ui`):

```tsx
import { Button, Sidebar } from "@workspace/ui/components";
import { Plus } from "@workspace/ui/icons";
```

To add an icon: find it on lucide.dev, add its export to the file in `frontend-kit/ui/src/icons/` named after its **first** category, and re-export from `index.ts` if that file is new.

## Gotchas

- **Kit spacing tokens hijack named sizes:** `max-w-sm` and similar resolve to a few px because of the kit's `--spacing-*` tokens. Use arbitrary values like `max-w-[24rem]`.
- **SWC drops the leading space in multi-line JSX text:** in `</span> text…` where the text wraps onto more source lines, write `</span>{" "}text…`.
