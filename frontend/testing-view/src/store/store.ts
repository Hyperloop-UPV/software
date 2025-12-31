import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAppSlice, type AppSlice } from "./slices/appSlice";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import {
  createConnectionsSlice,
  type ConnectionsSlice,
} from "./slices/connectionsSlice";
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
  ConnectionsSlice;

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
        tabFilters: state.tabFilters,
      }),
    },
  ),
  // { name: "Testing View Store" },
  // ),
);
