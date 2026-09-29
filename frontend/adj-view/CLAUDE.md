# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Dev server on port 9004
pnpm build        # tsc -b && vite build
pnpm lint         # ESLint
pnpm preview      # Preview production build
```

Run from the monorepo root (`/software`) targeting this workspace instead, if not already inside `frontend/adj-view`:

```bash
pnpm dev --filter adj-view
pnpm build:adj-view
pnpm add <package> --filter adj-view
```

> **pnpm only** — the `preinstall` script enforces this via `only-allow`.

There is no test suite for this workspace (`pnpm test` at the root skips it) — don't add one unless asked. Verify changes with `pnpm build` (type-checks via `tsc -b`) and `pnpm lint`; the only expected lint warning is the pre-existing `react-refresh/only-export-components` on `extractBoards` in `src/adj/v2/AdjViewerTabs.tsx`.

For UI changes, look at the result: Playwright and its Chromium are installed for the root `e2e` workspace, so a throwaway script (outside the repo) can open `http://localhost:9004/?commit=<sha>` against `pnpm dev`, click through and screenshot. Archives are fetched live from GitHub Pages, so any real ADJ commit SHA works.

## Architecture

`adj-view` is a standalone Vite+React workspace in the Hyperloop Control Station monorepo (`frontend/`). Unlike the other frontend views (`testing-view`, `competition-view`, `logging-view`), it has **no WebSocket connection, no Zustand store, and no session dependency** — it's a pure fetch-and-browse tool for ADJ archives. Everything the app knows comes from either a commit hash the user types in or a `?commit=<hash>` query param.

### What an ADJ archive is

"ADJ" (see [Hyperloop-UPV/ADJ](https://github.com/hyperloop-upv/adj)) is the pod's telemetry/board definition format: boards, their measurements (typed variables with units/enum values), packets (periodic telemetry) and orders (commands), and network sockets. `adj-view` fetches a JSON snapshot of this archive, built and published per-commit to GitHub Pages, and renders it for inspection. The v2 archive's shape is documented via inline comments in `src/adj/v2/types.ts` — read that file before touching parsing logic; the JSON has non-obvious nesting (e.g. `boards[boardName]` is a group containing both the board's own config *and* sibling keys like `${boardName}_measurements`, `packets`, `orders`, `sockets` — see `extractBoards` in `src/adj/v2/AdjViewerTabs.tsx` for how it's flattened).

### Versioning

The ADJ format is versioned, and adj-view must keep rendering every version it has supported. The version is read from the archive's **top-level `version` key** (`{ version, boards, general_info }`). **If it's absent, the archive is v2** — every archive published before versioning existed has no such key. Version-specific code lives in `src/adj/vN/`; nothing outside `src/adj/` may import from a `vN/` folder directly.

`src/adj/index.ts` is the only place that knows which versions exist: `detectAdjVersion` → `parseAdj` returns a `ParsedAdj` — either `{ supported: true, adj: LoadedAdj }` (a `{ version, data }` tagged union that `summarizeAdj` / `AdjViewer` in `src/adj/AdjViewer.tsx` switch on) or `{ supported: false, version }`. An unknown-but-well-formed version is **not** an error: the header's version badge turns amber and `src/components/UnsupportedAdjNotice.tsx` replaces the tabs, explaining the archive uses a newer ADJ format. Only a malformed `version` value (non-integer, boolean, empty string) throws.

To add a version N: create `src/adj/vN/` (types, viewer, summary), add `{ version: N; data: ... }` to `LoadedAdj`, add `case N` to `parseAdj`, and add N to `SUPPORTED_ADJ_VERSIONS` (used by the notice's text). The `assertNever(adj.version)` defaults then make `tsc` fail until `summarizeAdj` and `AdjViewer` handle it too.

Two external data sources, both configured in `config.ts`:
- **Archive JSON**: `https://hyperloop-upv.github.io/ADJ-Archive/storage/commit-<hash>.json` — fetched directly by commit hash, no auth.
- **GitHub API**: branch list and branch→commit resolution against `config.ADJ_GITHUB_REPO` (`hyperloop-upv/adj`), unauthenticated (rate-limited).

### Component structure

- `src/components/AdjViewerPage.tsx` — version-agnostic top-level page. Owns commit-hash input, branch combobox (via `useBranches`), fetch/loading/error state, and dark-mode toggle passed down from `App.tsx`. Reads `?commit=` on mount to support being launched from `logging-view`'s "View ADJ" shortcut. Only ever handles `LoadedAdj` — never a version-specific type — and renders `<AdjViewer>` once data is loaded.
- `src/adj/v2/AdjViewerTabs.tsx` — the v2 browser: Boards / Measurements / Packets / Network / Sockets / Throughput / General tabs, all fed by `extractBoards()`. Tabs share cross-navigation state lifted into this component (e.g. clicking a board in the Boards tab, or a packet in the Packets or Sockets tab, jumps to Measurements pre-filtered by board/variable IDs — see `handleJumpToMeasurements` / `handleJumpToPacketMeasurements`). This file is large and holds most of the UI logic. The list-tab atoms (`Highlight`, `SearchInput`, `SortableHeader`, `BoardChip`, `ResultCount`, `EmptyState`) live in `src/adj/v2/ui.tsx` and the `/`-to-search hook in `useKeyboardSearch.ts`, so tabs in their own files can reuse them.
- `src/adj/v2/NetworkTab.tsx` — hand-rolled SVG network topology diagram (boards on the left, `general_info.addresses` on the right, arrows colored by protocol derived from socket class names). No graph library is used or present in the monorepo; the node/edge count is small enough that manual two-column layout was simpler. See the file's header comments for the resolution rules used to match a socket's `remote_ip` to a board vs. a known address vs. an unknown external IP.
- `src/adj/v2/SocketsTab.tsx` — every socket in the ADJ as a filterable/sortable table: board side (`board_ip:port`), resolved remote, matching `general_info.ports` name, and the packets/orders that name the socket (expandable, jump to Measurements). Flags duplicate socket names, remote IPs that are neither a board nor a known address, and packets that reference a socket their board doesn't define.
- `src/adj/v2/sockets.ts` — the single place that interprets an `AdjSocket`, shared by Network, Sockets and Throughput: protocol and role, the board-side port (`boardPort`), `resolveTarget` for `remote_ip` (board / address key / unknown IP) and `portNames`. The ADJ schema (adj repo, `.github/workflows/scripts/adj-tester/schema/socket.schema.json`) has three types: `ServerSocket` (TCP server, `port`), `DatagramSocket` (UDP, `port` + `remote_ip`) and `Socket` (TCP client, `local_port` + `remote_ip` + `remote_port`); `main` only uses the first two.
- `src/adj/v2/ThroughputTab.tsx` (+ `throughput.ts`, `ThroughputHelp.tsx`) — bandwidth estimate per board; see [Throughput tab](#throughput-tab).
- `src/hooks/useBranches.ts` — fetches the branch list from GitHub, using `useTransition` (not manual loading state) and `AbortSignal.any` to combine an external abort with a fetch timeout.

### Throughput tab

A what-if estimate of each board's link usage, computed only from the ADJ and the backend's wire format (nothing is measured). All the maths lives in `src/adj/v2/throughput.ts` as pure functions; the UI never computes sizes itself.

**Model.** Everything is a `TrafficFlow`: a periodic stream of identical frames with a direction ("up" = board → backend, "down" = backend → board).
- **UDP data**: packets whose `socket` names one of the board's `DatagramSocket` sockets and that have a `period` (unit from `period_type`, converted via `PERIOD_UNIT_SECONDS`: ns/us/ms/s; unknown unit → packet listed as "not counted"). Payload mirrors the backend codec (`backend/pkg/transport/presentation/decoder.go`, `pkg/transport/packet/data/codec.go`): one packet per datagram = `uint16` ID + variables packed in ADJ order, enum and bool = 1 B. Orders and period-less packets are excluded.
- **TCP keep-alive**: the backend's empty ID-1 packet (`backend/pkg/transport/keepalive.go`, 2 B payload, `tcp.keep_alive_interval_ms` = 50 ms in `cmd/config.toml`), sent both ways, only for boards ticked "TCP connected" (stands in for `[vehicle] boards` in the backend config; defaults to boards with a TCP socket). `TCP_NODELAY` is set, so one segment per keep-alive, plus an optional pure-ACK segment each (worst case). Note the real backend treats an interval ≤ 0 as 50 ms, while the UI treats 0 as "off".
- **On the wire** = payload + transport header (UDP 8 / TCP 20, no options) + IPv4 20 + Ethernet 14 + FCS 4, padded to the 46 B minimum Ethernet payload, plus optionally preamble 8 + inter-frame gap 12. Every packet ≤ 18 B of UDP payload therefore costs 84 B. No fragmentation, VLAN, IP/TCP options or retransmissions.
- `TrafficOptions` toggles UDP, keep-alive, separate ACKs and preamble/gap (all on = worst case, the default). Change byte sizes only if the backend codec changes.

**What-if periods.** Clicking a UDP packet's period opens a value + unit editor (Enter/blur applies, Escape cancels). `PeriodOverrides` maps packet id → `{ value, unit }`; an override equal to the ADJ period in seconds (e.g. 10000 us vs 10 ms) is dropped. Overridden flows carry the original in `adjPeriod`/`adjPeriodUnit`; the ADJ data is never mutated.

**UI.** A sticky "Scenario" panel on the left (link capacity with 1M/10M/100M/1G presets, per-direction vs both-ways view, the two keep-alive intervals, the `TrafficOptions` checkboxes) and results on the right: one stacked bar per direction where 100% = link capacity, each board a segment (solid = UDP, 45°-striped = keep-alive), then a board table that doubles as the legend and expands into per-flow tables and a 3-step calculation breakdown. Board colours come from `--series-1…8` / `--series-other` in `src/index.css` (a CVD-validated categorical palette), assigned by fixed alphabetical board index — never by rank, so toggling things never repaints other boards.

**Help.** `ThroughputHelp.tsx` is the "How the numbers are calculated" side sheet. Every figure in it (layer sizes, minimums/maximums, worked example, keep-alive rate) is computed from the constants exported by `throughput.ts`; add new model assumptions there, never as literals in the help text.

### Workspace dependency

Only shared package used is `@workspace/ui` (from `frontend-kit/ui`), for shadcn/Radix components, Lucide icons, and small utilities (`cn`, `getTypeBadgeClass`/`typeBadgeClasses` from `@workspace/ui/lib`):

```tsx
import { Button, Combobox } from "@workspace/ui/components";
import { BookOpen, GitCommit } from "@workspace/ui/icons";
import { cn, getTypeBadgeClass, typeBadgeClasses } from "@workspace/ui/lib";
```

No `@workspace/core` dependency (no WebSocket/backend integration here).

### Styling

Tailwind v4 with CSS-variable theming, dark mode via `.dark` class on `<html>` (toggled in `App.tsx`, persisted to `localStorage["adj-view-dark-mode"]`). `NetworkTab`'s SVG reads the same CSS variables (`var(--primary)`, `var(--foreground)`, etc.) directly in inline styles so the diagram adapts automatically between themes. UI copy is English (sentence case, no all-caps labels); numbers use `tabular-nums` rather than a monospace font.

Branding: the header and empty state use the team mark `@workspace/ui/outreach/main/logo_icon.svg` (not the H11 isotype the other views use), via `TeamLogo` in `AdjViewerPage.tsx`. The header pairs it with the software-team logo (`outreach/main/software_black.png` + `dark:invert`; don't use `software_white.png`, which is 8000 px / 430 KB). That SVG draws the mark in only the middle ~49% of its 900×900 viewBox, so `TeamLogo` scales the image up inside a clipped box; a plain `<img className="size-9">` renders it tiny.

The layout must work down to phone width (check 390 / 768 / 1440 px) without the page scrolling sideways. The header wraps into title + theme toggle, then a full-width row of load controls below `lg`. The tab bar scrolls inside itself, and wide tables and the Network SVG scroll inside their own containers.

### Gotchas

- **Kit spacing tokens hijack named sizes**: `frontend-kit`'s `--spacing-sm/md/…` make `max-w-sm` etc. resolve to a few px (the kit's own `SheetContent` ships `sm:max-w-sm`). Always use arbitrary values like `max-w-[42rem]`.
- **SWC drops a leading space in multi-line JSX text**: in `<span>Label:</span> text that wraps onto\n more lines`, the space after `</span>` disappears. Write `</span>{" "}text`.
- **Sticky needs no clipping ancestor**: the Throughput `TabsContent` deliberately has no `overflow-hidden` (unlike the other tabs); adding it back breaks the sticky Scenario panel. Page scrolling happens on `App.tsx`'s root `overflow-auto` div, since the tab content isn't height-constrained.
