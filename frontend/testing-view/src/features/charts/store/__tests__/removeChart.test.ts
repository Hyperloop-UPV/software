import { beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_ID, addChart, createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
});

describe("removeChart", () => {
  it("removes the correct chart", () => {
    const id = addChart(store);
    store.getState().removeChart(WORKSPACE_ID, id);

    expect(store.getState().charts[WORKSPACE_ID]).toHaveLength(0);
  });

  it("does not remove other charts in the same workspace", () => {
    const id1 = addChart(store);
    const id2 = addChart(store);

    store.getState().removeChart(WORKSPACE_ID, id1);

    const remaining = store.getState().charts[WORKSPACE_ID];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });

  it("does not affect charts in other workspaces", () => {
    const id = addChart(store, "workspace-2");
    addChart(store);

    store.getState().removeChart(WORKSPACE_ID, store.getState().charts[WORKSPACE_ID][0].id);

    expect(store.getState().charts["workspace-2"].find((c) => c.id === id)).toBeDefined();
  });

  it("does nothing when the chart ID does not exist", () => {
    addChart(store);
    const countBefore = store.getState().charts[WORKSPACE_ID].length;

    store.getState().removeChart(WORKSPACE_ID, "non-existent-id");

    expect(store.getState().charts[WORKSPACE_ID]).toHaveLength(countBefore);
  });
});
