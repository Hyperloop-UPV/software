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

export interface Store extends CatalogSlice, WorkspacesSlice, TelemetrySlice {}

export const useStore = create<Store>()((...a) => ({
  ...createCatalogSlice(...a),
  ...createWorkspacesSlice(...a),
  ...createTelemetrySlice(...a),
}));
