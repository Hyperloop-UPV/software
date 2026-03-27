import { create } from "zustand";
import { createChartsSlice } from "../chartsSlice";
import { createAppSlice } from "../../../../store/slices/appSlice";
import { createCatalogSlice } from "../../../../store/slices/catalogSlice";
import { createConnectionsSlice } from "../../../../store/slices/connectionsSlice";
import { createMessagesSlice } from "../../../../store/slices/messagesSlice";
import { createTelemetrySlice } from "../../../../store/slices/telemetrySlice";
import { createRightSidebarSlice } from "../../../workspace/store/rightSidebarSlice";
import { createWorkspacesSlice } from "../../../workspace/store/workspacesSlice";
import { createFilteringSlice } from "../../../filtering/store/filteringSlice";
import type { Store } from "../../../../store/store";
import type { WorkspaceChartSeries } from "../../types/charts";

export const createTestStore = () =>
  create<Store>()((...a) => ({
    ...createAppSlice(...a),
    ...createCatalogSlice(...a),
    ...createWorkspacesSlice(...a),
    ...createTelemetrySlice(...a),
    ...createRightSidebarSlice(...a),
    ...createConnectionsSlice(...a),
    ...createMessagesSlice(...a),
    ...createChartsSlice(...a),
    ...createFilteringSlice(...a),
  }));

export const WORKSPACE_ID = "workspace-1";

export const SERIES_A: WorkspaceChartSeries = {
  packetId: 1,
  variable: "speed",
};

export const SERIES_B: WorkspaceChartSeries = {
  packetId: 2,
  variable: "temperature",
};

export const SERIES_ENUM: WorkspaceChartSeries = {
  packetId: 3,
  variable: "state",
  enumOptions: ["Idle", "Running", "Fault"],
};

/** Adds a chart to the given workspace and returns its ID. */
export function addChart(
  store: ReturnType<typeof createTestStore>,
  workspaceId = WORKSPACE_ID,
) {
  return store.getState().addChart(workspaceId);
}
