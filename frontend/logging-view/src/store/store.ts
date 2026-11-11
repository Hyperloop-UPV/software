import { create } from "zustand";
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
