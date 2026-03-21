import { create } from "zustand";
import { createChartsSlice } from "../../../charts/store/chartsSlice";
import { createFilteringSlice } from "../filteringSlice";
import { createAppSlice } from "../../../../store/slices/appSlice";
import { createCatalogSlice } from "../../../../store/slices/catalogSlice";
import { createConnectionsSlice } from "../../../../store/slices/connectionsSlice";
import { createMessagesSlice } from "../../../../store/slices/messagesSlice";
import { createTelemetrySlice } from "../../../../store/slices/telemetrySlice";
import { createRightSidebarSlice } from "../../../workspace/store/rightSidebarSlice";
import { createWorkspacesSlice } from "../../../workspace/store/workspacesSlice";
import type { Store } from "../../../../store/store";
import type { BoardName } from "../../../../types/data/board";

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

export const BOARDS: BoardName[] = ["BCU", "PCU"];

export const COMMANDS_CATALOG = {
  BCU: [
    { id: 1, name: "cmd_start", label: "Start" },
    { id: 2, name: "cmd_stop", label: "Stop" },
  ],
  PCU: [{ id: 3, name: "cmd_reset", label: "Reset" }],
};

export const TELEMETRY_CATALOG = {
  BCU: [
    { id: 10, name: "bcu_speed", label: "Speed" },
    { id: 20, name: "bcu_temp", label: "Temperature" },
  ],
  PCU: [{ id: 30, name: "pcu_voltage", label: "Voltage" }],
};

export function seedStore(store: ReturnType<typeof createTestStore>) {
  const s = store.getState();
  s.setBoards(BOARDS);
  s.setCommandsCatalog(COMMANDS_CATALOG);
  s.setTelemetryCatalog(TELEMETRY_CATALOG);
  s.initializeWorkspaceFilters();
}
