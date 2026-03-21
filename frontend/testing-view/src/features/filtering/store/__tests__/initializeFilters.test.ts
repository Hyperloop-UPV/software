import { beforeEach, describe, expect, it } from "vitest";
import { createTestStore, seedStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
});

describe("initializeWorkspaceFilters", () => {
  it("populates all default workspaces", () => {
    seedStore(store);
    const filters = store.getState().workspaceFilters;

    expect(Object.keys(filters)).toEqual(
      expect.arrayContaining(["workspace-1", "workspace-2", "workspace-3"]),
    );
  });

  it("initializes commands filters with all command IDs", () => {
    seedStore(store);
    const filters = store.getState().workspaceFilters["workspace-1"];

    expect(filters.commands["BCU"]).toEqual([1, 2]);
    expect(filters.commands["PCU"]).toEqual([3]);
  });

  it("initializes telemetry filters with all telemetry IDs", () => {
    seedStore(store);
    const filters = store.getState().workspaceFilters["workspace-1"];

    expect(filters.telemetry["BCU"]).toEqual([10, 20]);
    expect(filters.telemetry["PCU"]).toEqual([30]);
  });

  it("initializes logs filters with all telemetry IDs", () => {
    seedStore(store);
    const filters = store.getState().workspaceFilters["workspace-1"];

    expect(filters.logs["BCU"]).toEqual([10, 20]);
    expect(filters.logs["PCU"]).toEqual([30]);
  });

  it("is idempotent — does not overwrite existing filters", () => {
    seedStore(store);
    store.getState().clearFilters("commands");
    const filtersAfterClear = store.getState().workspaceFilters;

    store.getState().initializeWorkspaceFilters();

    expect(store.getState().workspaceFilters).toStrictEqual(filtersAfterClear);
  });
});
