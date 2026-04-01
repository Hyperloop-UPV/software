import { beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_ID, addChart, createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
});

describe("getActiveWorkspaceCharts", () => {
  it("returns the charts for the active workspace", () => {
    const id = addChart(store);

    const charts = store.getState().getActiveWorkspaceCharts();
    expect(charts).toHaveLength(1);
    expect(charts[0].id).toBe(id);
  });

  it("returns an empty array when the workspace has no charts", () => {
    expect(store.getState().getActiveWorkspaceCharts()).toStrictEqual([]);
  });

  it("reflects the active workspace — switching workspaces returns different charts", () => {
    addChart(store);

    const workspace2 = store.getState().workspaces[1];
    store.getState().setActiveWorkspace(workspace2);

    expect(store.getState().getActiveWorkspaceCharts()).toHaveLength(0);
  });

  it("updates after a chart is added", () => {
    expect(store.getState().getActiveWorkspaceCharts()).toHaveLength(0);

    addChart(store);

    expect(store.getState().getActiveWorkspaceCharts()).toHaveLength(1);
  });

  it("updates after a chart is removed", () => {
    const id = addChart(store);
    store.getState().removeChart(WORKSPACE_ID, id);

    expect(store.getState().getActiveWorkspaceCharts()).toStrictEqual([]);
  });
});
