import { beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_ID, addChart, createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;
let chartId: string;

beforeEach(() => {
  store = createTestStore();
  chartId = addChart(store);
});

describe("setChartHistoryLimit", () => {
  it("updates the history limit for the correct chart", () => {
    store.getState().setChartHistoryLimit(WORKSPACE_ID, chartId, 500);

    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === chartId);
    expect(chart?.historyLimit).toBe(500);
  });

  it("does not affect other charts in the same workspace", () => {
    const otherId = addChart(store);
    const otherLimitBefore = store.getState().charts[WORKSPACE_ID].find((c) => c.id === otherId)?.historyLimit;

    store.getState().setChartHistoryLimit(WORKSPACE_ID, chartId, 500);

    const otherChart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === otherId);
    expect(otherChart?.historyLimit).toBe(otherLimitBefore);
  });

  it("does not affect charts in other workspaces", () => {
    const otherChartId = addChart(store, "workspace-2");
    const otherLimitBefore = store.getState().charts["workspace-2"].find((c) => c.id === otherChartId)?.historyLimit;

    store.getState().setChartHistoryLimit(WORKSPACE_ID, chartId, 500);

    const otherChart = store.getState().charts["workspace-2"].find((c) => c.id === otherChartId);
    expect(otherChart?.historyLimit).toBe(otherLimitBefore);
  });
});
