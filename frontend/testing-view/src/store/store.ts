import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAppSlice, type AppSlice } from "./slices/appSlice";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import { createChartsSlice, type ChartsSlice } from "./slices/chartsSlice";
import {
  createConnectionsSlice,
  type ConnectionsSlice,
} from "./slices/connectionsSlice";
import {
  createFilteringSlice,
  type FilteringSlice,
} from "./slices/filteringSlice";
import {
  createMessagesSlice,
  type MessagesSlice,
} from "./slices/messagesSlice";
import {
  createRightSidebarSlice,
  type RightSidebarSlice,
} from "./slices/rightSidebarSlice";
import {
  createTelemetrySlice,
  type TelemetrySlice,
} from "./slices/telemetrySlice";
import {
  createWorkspacesSlice,
  type WorkspacesSlice,
} from "./slices/workspacesSlice";

export type Store = AppSlice &
  CatalogSlice &
  WorkspacesSlice &
  TelemetrySlice &
  RightSidebarSlice &
  ConnectionsSlice &
  MessagesSlice &
  ChartsSlice &
  FilteringSlice;

export const useStore = create<Store>()(
  // devtools(
  persist(
    (...a) => ({
      ...createAppSlice(...a),
      ...createCatalogSlice(...a),
      ...createWorkspacesSlice(...a),
      ...createTelemetrySlice(...a),
      ...createRightSidebarSlice(...a),
      ...createConnectionsSlice(...a),
      ...createMessagesSlice(...a),
      ...createChartsSlice(...a),
      ...createFilteringSlice(...a),
    }),
    {
      // Partial persist
      name: "testing-view-storage",
      partialize: (state) => ({
        // Charts
        charts: state.charts,

        // Workspaces
        workspaces: state.workspaces,
        activeWorkspace: state.activeWorkspace,

        // User preferences
        colorScheme: state.colorScheme,
        isDarkMode: state.isDarkMode,
        testingPage: state.testingPage,

        // Workspace UI state
        activeTab: state.activeTab,
        tabFilters: state.workspaceFilters,
      }),
    },
  ),
  // { name: "Testing View Store" },
  // ),
);
