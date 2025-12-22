import { create } from "zustand";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import {
  createTelemetrySlice,
  type TelemetrySlice,
} from "./slices/telemetrySlice";
import {
  createWorkspacesSlice,
  type WorkspacesSlice,
} from "./slices/workspacesSlice";
import { createAppSlice, type AppSlice } from "./slices/appSlice";
import {
  createRightSidebarSlice,
  type RightSidebarSlice,
} from "./slices/rightSidebarSlice";

export type Store = AppSlice &
  CatalogSlice &
  WorkspacesSlice &
  TelemetrySlice &
  RightSidebarSlice;

export const useStore = create<Store>()((...a) => ({
  ...createAppSlice(...a),
  ...createCatalogSlice(...a),
  ...createWorkspacesSlice(...a),
  ...createTelemetrySlice(...a),
  ...createRightSidebarSlice(...a),
}));
