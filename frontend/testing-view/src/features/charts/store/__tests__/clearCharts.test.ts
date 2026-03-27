import { beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_ID, addChart, createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
});

describe("clearCharts", () => {
  it("removes all charts from the active workspace", () => {
    addChart(store);
    addChart(store);

    store.getState().clearCharts();

    expect(store.getState().charts[WORKSPACE_ID]).toHaveLength(0);
  });

  it("does not affect charts in other workspaces", () => {
    addChart(store, "workspace-2");
    addChart(store);

    store.getState().clearCharts();

    expect(store.getState().charts["workspace-2"]).toHaveLength(1);
  });
});
