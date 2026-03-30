import { beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_ID, addChart, createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;
let id1: string;
let id2: string;
let id3: string;

beforeEach(() => {
  store = createTestStore();
  id1 = addChart(store);
  id2 = addChart(store);
  id3 = addChart(store);
});

const chartIds = () =>
  store.getState().charts[WORKSPACE_ID].map((c) => c.id);

describe("reorderCharts", () => {
  it("moves a chart forward in the list", () => {
    store.getState().reorderCharts(WORKSPACE_ID, 0, 2);

    expect(chartIds()).toStrictEqual([id2, id3, id1]);
  });

  it("moves a chart backward in the list", () => {
    store.getState().reorderCharts(WORKSPACE_ID, 2, 0);

    expect(chartIds()).toStrictEqual([id3, id1, id2]);
  });

  it("is a no-op when old and new index are the same", () => {
    store.getState().reorderCharts(WORKSPACE_ID, 1, 1);

    expect(chartIds()).toStrictEqual([id1, id2, id3]);
  });

  it("does nothing when oldIndex is negative", () => {
    store.getState().reorderCharts(WORKSPACE_ID, -1, 1);

    expect(chartIds()).toStrictEqual([id1, id2, id3]);
  });

  it("does nothing when newIndex is negative", () => {
    store.getState().reorderCharts(WORKSPACE_ID, 0, -1);

    expect(chartIds()).toStrictEqual([id1, id2, id3]);
  });

  it("does not affect other workspaces", () => {
    const otherId = addChart(store, "workspace-2");
    store.getState().reorderCharts(WORKSPACE_ID, 0, 2);

    expect(store.getState().charts["workspace-2"].map((c) => c.id)).toStrictEqual([otherId]);
  });
});
