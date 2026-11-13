import { create } from "zustand";
import { saveSessionDashboards } from "../lib/normal/dashboardStorage";
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
