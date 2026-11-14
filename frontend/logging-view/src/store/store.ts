import { create } from "zustand";
import { saveSessionDashboards } from "../lib/normal/dashboardStorage";
import {
  HISTORY_LIMIT,
  MERGE_MS,
  isViewOnlyChange,
  type DashboardHistory,
} from "../lib/normal/history";
import { historyReplay } from "./slices/normalDashboardsSlice";
import { persist } from "zustand/middleware";
import {
  createNormalDashboardsSlice,
  type NormalDashboardsSlice,
} from "./slices/normalDashboardsSlice";
import { createAppSlice, type AppSlice } from "./slices/appSlice";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import {
  createConnectionsSlice,
  type ConnectionsSlice,
} from "./slices/connectionsSlice";
import {
  createMessagesSlice,
  type MessagesSlice,
} from "./slices/messagesSlice";
import {
  createPlotStudioSlice,
  type PlotStudioSlice,
} from "./slices/plotStudioSlice";
import {
  createRecentSessionsSlice,
  type RecentSessionsSlice,
} from "./slices/recentSessionsSlice";
import { createSessionSlice, type SessionSlice } from "./slices/sessionSlice";
import {
  createTelemetrySlice,
  type TelemetrySlice,
} from "./slices/telemetrySlice";

export type Store = AppSlice &
  CatalogSlice &
  ConnectionsSlice &
  MessagesSlice &
  PlotStudioSlice &
  RecentSessionsSlice &
  SessionSlice &
  TelemetrySlice &
  NormalDashboardsSlice;

export const useStore = create<Store>()(
  persist(
    (...a) => ({
      ...createAppSlice(...a),
      ...createCatalogSlice(...a),
      ...createConnectionsSlice(...a),
      ...createMessagesSlice(...a),
      ...createPlotStudioSlice(...a),
      ...createRecentSessionsSlice(...a),
      ...createSessionSlice(...a),
      ...createTelemetrySlice(...a),
      ...createNormalDashboardsSlice(...a),
    }),
    {
      name: "competition-view-storage",
      version: 1,
      // Only persist lightweight user-preference data, never live telemetry.
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        recentSessions: state.recentSessions,
      }),
    },
  ),
);

// Normal mode dashboards are saved per session folder, apart from the
// preferences above: they are larger, and keyed by the session they belong to.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const saveDashboards = () => {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const { folderName, normalDashboards, activeNormalDashboardId } =
    useStore.getState();
  if (folderName)
    saveSessionDashboards(
      folderName,
      normalDashboards,
      activeNormalDashboardId,
    );
};
useStore.subscribe((state, previous) => {
  if (
    state.normalDashboards === previous.normalDashboards &&
    state.activeNormalDashboardId === previous.activeNormalDashboardId
  )
    return;
  // Closing a session resets the dashboards; that reset is not a change to
  // save, and neither is whatever was still pending for the closed session.
  if (!state.folderName || state.folderName !== previous.folderName) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    if (state.folderName) saveDashboards();
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDashboards, 500);
});
if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    if (saveTimer !== undefined) saveDashboards();
  });

// Undo history for Normal mode dashboards, recorded here rather than in each
// action so that every way of editing a dashboard is covered.
const lastRecordedAt = new Map<string, number>();
useStore.subscribe((state, previous) => {
  if (state.normalDashboards === previous.normalDashboards) return;
  // A new session or a closed one starts every dashboard afresh.
  if (state.folderName !== previous.folderName) {
    lastRecordedAt.clear();
    if (Object.keys(state.normalHistory).length > 0)
      useStore.setState({ normalHistory: {} });
    return;
  }
  if (historyReplay.active) return;
  const before = new Map(
    previous.normalDashboards.map((dashboard) => [dashboard.id, dashboard]),
  );
  const now = performance.now();
  let history: Record<string, DashboardHistory> | null = null;
  for (const dashboard of state.normalDashboards) {
    const old = before.get(dashboard.id);
    if (!old || old.settings === dashboard.settings) continue;
    if (isViewOnlyChange(old.settings, dashboard.settings)) continue;
    history ??= { ...state.normalHistory };
    const current = history[dashboard.id] ?? { past: [], future: [] };
    const merge =
      now - (lastRecordedAt.get(dashboard.id) ?? -Infinity) < MERGE_MS;
    lastRecordedAt.set(dashboard.id, now);
    history[dashboard.id] = {
      past:
        merge && current.past.length > 0
          ? current.past
          : [...current.past, old.settings].slice(-HISTORY_LIMIT),
      future: [],
    };
  }
  // Closed dashboards take their history with them.
  const alive = new Set(
    state.normalDashboards.map((dashboard) => dashboard.id),
  );
  for (const id of Object.keys(history ?? state.normalHistory))
    if (!alive.has(id)) {
      history ??= { ...state.normalHistory };
      delete history[id];
      lastRecordedAt.delete(id);
    }
  if (history) useStore.setState({ normalHistory: history });
});
