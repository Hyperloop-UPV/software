import { beforeEach, describe, expect, it } from "vitest";
import { config } from "../../../../../config";
import { WORKSPACE_ID, createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
});

describe("addChart", () => {
  it("adds a chart to the specified workspace", () => {
    store.getState().addChart(WORKSPACE_ID);

    expect(store.getState().charts[WORKSPACE_ID]).toHaveLength(1);
  });

  it("returns the new chart's ID", () => {
    const id = store.getState().addChart(WORKSPACE_ID);

    expect(store.getState().charts[WORKSPACE_ID][0].id).toBe(id);
  });

  it("initializes the chart with an empty series array", () => {
    const id = store.getState().addChart(WORKSPACE_ID);
    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === id);

    expect(chart?.series).toStrictEqual([]);
  });

  it("initializes the chart with the default history limit", () => {
    const id = store.getState().addChart(WORKSPACE_ID);
    const chart = store.getState().charts[WORKSPACE_ID].find((c) => c.id === id);

    expect(chart?.historyLimit).toBe(config.DEFAULT_CHART_HISTORY_LIMIT);
  });

  it("does not affect other workspaces", () => {
    const chartsBefore = store.getState().charts["workspace-2"];
    store.getState().addChart(WORKSPACE_ID);

    expect(store.getState().charts["workspace-2"]).toStrictEqual(chartsBefore);
  });

  it("each call adds a distinct chart", () => {
    const id1 = store.getState().addChart(WORKSPACE_ID);
    const id2 = store.getState().addChart(WORKSPACE_ID);

    expect(id1).not.toBe(id2);
    expect(store.getState().charts[WORKSPACE_ID]).toHaveLength(2);
  });
});
