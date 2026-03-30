import { beforeEach, describe, expect, it } from "vitest";
import { SERIES_A, SERIES_B, SERIES_ENUM, WORKSPACE_ID, addChart, createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;
let chartId: string;

beforeEach(() => {
  store = createTestStore();
  chartId = addChart(store);
});

// ─── addSeriesToChart ─────────────────────────────────────────────────────────

describe("addSeriesToChart", () => {
  it("adds a series to the correct chart", () => {
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_A);

    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === chartId);
    expect(chart?.series).toHaveLength(1);
    expect(chart?.series[0]).toStrictEqual(SERIES_A);
  });

  it("appends multiple series in order", () => {
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_A);
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_B);

    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === chartId);
    expect(chart?.series).toStrictEqual([SERIES_A, SERIES_B]);
  });

  it("supports enum series", () => {
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_ENUM);

    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === chartId);
    expect(chart?.series[0].enumOptions).toStrictEqual(["Idle", "Running", "Fault"]);
  });

  it("does not affect other charts in the same workspace", () => {
    const otherId = addChart(store);
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_A);

    const otherChart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === otherId);
    expect(otherChart?.series).toHaveLength(0);
  });

  it("does not affect charts in other workspaces", () => {
    const otherChartId = addChart(store, "workspace-2");
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_A);

    const otherChart = store.getState().charts["workspace-2"].find((c) => c.id === otherChartId);
    expect(otherChart?.series).toHaveLength(0);
  });
});

// ─── removeSeriesFromChart ────────────────────────────────────────────────────

describe("removeSeriesFromChart", () => {
  beforeEach(() => {
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_A);
    store.getState().addSeriesToChart(WORKSPACE_ID, chartId, SERIES_B);
  });

  it("removes the series with the given variable name", () => {
    store.getState().removeSeriesFromChart(WORKSPACE_ID, chartId, SERIES_A.variable);

    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === chartId);
    expect(chart?.series.find((s) => s.variable === SERIES_A.variable)).toBeUndefined();
  });

  it("keeps other series in the same chart", () => {
    store.getState().removeSeriesFromChart(WORKSPACE_ID, chartId, SERIES_A.variable);

    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === chartId);
    expect(chart?.series).toHaveLength(1);
    expect(chart?.series[0]).toStrictEqual(SERIES_B);
  });

  it("does not affect other charts", () => {
    const otherId = addChart(store);
    store.getState().addSeriesToChart(WORKSPACE_ID, otherId, SERIES_A);

    store.getState().removeSeriesFromChart(WORKSPACE_ID, chartId, SERIES_A.variable);

    const otherChart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === otherId);
    expect(otherChart?.series).toHaveLength(1);
  });
});
