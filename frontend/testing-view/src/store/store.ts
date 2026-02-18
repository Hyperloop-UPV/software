import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createChartsSlice,
  type ChartsSlice,
} from "../features/charts/store/chartsSlice";
import {
  createFilteringSlice,
  type FilteringSlice,
} from "../features/filtering/store/filteringSlice";
import {
  createRightSidebarSlice,
  type RightSidebarSlice,
} from "../features/workspace/store/rightSidebarSlice";
import {
  createWorkspacesSlice,
  type WorkspacesSlice,
} from "../features/workspace/store/workspacesSlice";
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
  createTelemetrySlice,
  type TelemetrySlice,
} from "./slices/telemetrySlice";

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
        workspaceFilters: state.workspaceFilters,
      }),
    },
  ),
  // { name: "Testing View Store" },
  // ),
);
