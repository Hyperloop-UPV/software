// Session slice: manages the opened log folder, fetched ADJ data, and series selection.
//
// Flow: openSession(FileList) → read logger_settings.json → fetch ADJ archive →
//       scan data/ entries → update state.
//
// Files are keyed by webkitRelativePath ("folder/data/BOARD/meas.csv") and kept
// in sessionFiles for later CSV reading during plotting. Not persisted.
//
// openSession never aborts the whole load on a settings or ADJ failure — each stage
// is independently fallible so a session can still open in CSV-only "degraded" mode.
// See SessionStatus (types/session.ts) for the resulting green/yellow/red cascade.
import type { StateCreator } from "zustand";
import type {
  AdjArchive,
  AdjStatus,
  DroppedFile,
  LoggerSettings,
  LoggedOrder,
  SeriesKey,
  SessionStatus,
} from "../../types/session";
import { parseOrdersCsv } from "../../lib/orders";
import type { Store } from "../store";

const ADJ_ARCHIVE_URL = (hash: string) =>
  `https://hyperloop-upv.github.io/ADJ-Archive/storage/commit-${hash}.json`;

type SettingsIssue = "missing" | "malformed" | null;

function computeSessionStatus(
  settingsIssue: SettingsIssue,
  availableSeries: Record<string, string[]>,
  adjStatus: AdjStatus | null,
): SessionStatus {
  const hasCsv = Object.keys(availableSeries).length > 0;

  if (settingsIssue === null) {
    return { level: "ok", message: "Session loaded correctly.", adj: adjStatus };
  }

  if (hasCsv) {
    const reason =
      settingsIssue === "malformed"
        ? "logger_settings.json is malformed"
        : "logger_settings.json not found";
    return {
      level: "degraded",
      message: `${reason} — showing CSV data only.`,
      adj: adjStatus,
    };
  }

  const reason =
    settingsIssue === "malformed"
      ? "logger_settings.json is malformed and no CSV data was found"
      : "No logger_settings.json or CSV data was found";
  return { level: "error", message: `${reason} in this folder.`, adj: adjStatus };
}

export interface SessionSlice {
  folderName: string | null;
  settings: LoggerSettings | null;
  adjData: AdjArchive | null;
  // Board name → array of measurement IDs found in data/<BOARD>/*.csv
  availableSeries: Record<string, string[]>;
  // Selected series keys ("BOARD/measurementId") stored as a set-like Record.
  selectedSeries: Record<SeriesKey, boolean>;
  // All session files keyed by webkitRelativePath, for later CSV reading.
  sessionFiles: Map<string, DroppedFile>;
  orders: LoggedOrder[];
  isLoading: boolean;
  // Persistent — reflects the currently open session, cleared only by clearSession.
  sessionStatus: SessionStatus | null;
  // Transient — set once per openSession() call, meant to auto-dismiss as a toast.
  // Kept separate from sessionStatus so dismissing the toast doesn't blank the badge.
  sessionStatusToast: SessionStatus | null;
  // Open/closed state of the "Session" collapsible in the sidebar. Auto-closes
  // the first time a measurement gets checked (0 → 1 selected), to free up
  // space for the series list — but not on every subsequent selection, so a
  // user who reopens it isn't fought every time they check another box.
  isSessionPanelOpen: boolean;

  // Accepts files from <input webkitdirectory> or a directory drop traversal.
  openSession: (files: DroppedFile[]) => Promise<void>;
  toggleSeries: (key: SeriesKey) => void;
  clearSelectedSeries: () => void;
  clearSession: () => void;
  setSessionPanelOpen: (open: boolean) => void;
  setSessionStatusToast: (status: SessionStatus | null) => void;
}

export const createSessionSlice: StateCreator<Store, [], [], SessionSlice> = (set) => ({
  folderName: null,
  settings: null,
  adjData: null,
  availableSeries: {},
  selectedSeries: {},
  sessionFiles: new Map(),
  orders: [],
  isLoading: false,
  sessionStatus: null,
  sessionStatusToast: null,
  isSessionPanelOpen: true,

  openSession: async (files) => {
    try {
      set({ isLoading: true });

      const fileArray = files;

      // Derive the session folder name from the first file's relative path.
      const folderName = fileArray[0]?.webkitRelativePath.split("/")[0] ?? "Session";

      // Stage 1: locate + parse logger_settings.json at the folder root (2 path
      // segments). A missing or malformed file doesn't abort the load — it just
      // downgrades the eventual status to "degraded"/"error" below.
      let settings: LoggerSettings | null = null;
      let settingsIssue: SettingsIssue = null;
      const settingsFile = fileArray.find(
        (f) =>
          f.name === "logger_settings.json" &&
          f.webkitRelativePath.split("/").length === 2,
      );
      if (!settingsFile) {
        settingsIssue = "missing";
      } else {
        try {
          const parsed = JSON.parse(await settingsFile.text());
          if (!parsed?.adj_commit_hash) throw new Error("missing adj_commit_hash");
          settings = parsed;
        } catch {
          settingsIssue = "malformed";
        }
      }

      // Stage 2: build board → measurementIds map from data/<BOARD>/<id>.csv files.
      // webkitRelativePath format: folder/data/BOARD/measurement.csv (4 segments).
      // Runs regardless of settings outcome — this is what makes CSV-only mode work.
      // Deduped via Set: directory drops can yield the same relative path twice
      // (e.g. rotated/overlapping log files), which would otherwise show up as
      // duplicate rows in the series sidebar.
      const availableSeriesSets: Record<string, Set<string>> = {};
      for (const f of fileArray) {
        const parts = f.webkitRelativePath.split("/");
        if (parts.length === 4 && parts[1] === "data" && f.name.endsWith(".csv")) {
          const boardName = parts[2];
          const measId = f.name.slice(0, -4);
          (availableSeriesSets[boardName] ??= new Set()).add(measId);
        }
      }
      const availableSeries: Record<string, string[]> = {};
      for (const [boardName, ids] of Object.entries(availableSeriesSets)) {
        availableSeries[boardName] = [...ids];
      }

      // Stage 3: fetch the ADJ archive snapshot, only possible when settings parsed
      // (adj_commit_hash lives there). Failure here never aborts the session load —
      // it's surfaced as an additional AdjStatus layered on the overall status.
      let adjData: AdjArchive | null = null;
      let adjStatus: AdjStatus | null = null;
      if (settings) {
        try {
          const adjResponse = await fetch(ADJ_ARCHIVE_URL(settings.adj_commit_hash));
          if (!adjResponse.ok) throw new Error(`ADJ fetch failed: ${adjResponse.status}`);
          adjData = await adjResponse.json();
          adjStatus = { ok: true, message: null };
        } catch (err) {
          adjStatus = {
            ok: false,
            message: `ADJ archive not found for commit ${settings.adj_commit_hash.slice(0, 7)} — signal names/units unavailable.`,
          };
          void err;
        }
      }

      // Orders are optional session events. Their absence or malformed content
      // never changes the telemetry session status.
      let orders: LoggedOrder[] = [];
      const orderFile = fileArray.find((f) => {
        const parts = f.webkitRelativePath.split("/");
        return f.name === "order.csv" && parts.length === 3 && parts[1] === "order";
      });
      if (orderFile) {
        try {
          orders = parseOrdersCsv(await orderFile.text(), settings?.time_unit ?? "ms", adjData);
        } catch { /* Leave events empty when an optional order file cannot be read. */ }
      }

      const status = computeSessionStatus(settingsIssue, availableSeries, adjStatus);

      set({
        folderName,
        settings,
        adjData,
        availableSeries,
        selectedSeries: {},
        sessionFiles: new Map(fileArray.map((f) => [f.webkitRelativePath, f])),
        orders,
        isLoading: false,
        isSessionPanelOpen: true,
        sessionStatus: status,
        sessionStatusToast: status,
      });
    } catch (err) {
      // Last-resort net for genuinely unexpected exceptions (e.g. a DroppedFile.text()
      // I/O rejection) — the staged logic above should make this rare.
      const status: SessionStatus = { level: "error", message: String(err), adj: null };
      set({ isLoading: false, sessionStatus: status, sessionStatusToast: status });
    }
  },

  toggleSeries: (key) =>
    set((s) => {
      const wasSelected = Object.values(s.selectedSeries).filter(Boolean).length > 0;
      const nextSelectedSeries = {
        ...s.selectedSeries,
        [key]: !s.selectedSeries[key],
      };
      const isSelectedNow = Object.values(nextSelectedSeries).filter(Boolean).length > 0;
      // Auto-close only on the 0 → 1 transition — not on every later toggle,
      // so reopening it manually and checking more boxes doesn't re-close it.
      const justSelectedFirst = !wasSelected && isSelectedNow;
      return {
        selectedSeries: nextSelectedSeries,
        ...(justSelectedFirst ? { isSessionPanelOpen: false } : {}),
      };
    }),

  clearSelectedSeries: () => set({ selectedSeries: {} }),

  setSessionPanelOpen: (open) => set({ isSessionPanelOpen: open }),

  setSessionStatusToast: (status) => set({ sessionStatusToast: status }),

  // Closing a session also tears down everything built from it in Plot
  // Studio — plots, loaded CSV signals, and composed operations/transforms
  // (derived from those same CSVs) — since none of it means anything once
  // its source session is gone.
  clearSession: () =>
    set({
      folderName: null,
      settings: null,
      adjData: null,
      availableSeries: {},
      selectedSeries: {},
      sessionFiles: new Map(),
      orders: [],
      sessionStatus: null,
      sessionStatusToast: null,
      isSessionPanelOpen: true,
      studioPlots: new Map(),
      studioFiles: new Map(),
      studioOperations: new Map(),
      studioTransforms: new Map(),
    }),
});
