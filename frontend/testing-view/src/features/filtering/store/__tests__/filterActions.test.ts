import { beforeEach, describe, expect, it } from "vitest";
import { createTestStore, seedStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
  seedStore(store);
});

// ─── selectAllFilters ─────────────────────────────────────────────────────────

describe("selectAllFilters", () => {
  it("restores all command IDs after a clear", () => {
    store.getState().clearFilters("commands");
    store.getState().selectAllFilters("commands");

    expect(store.getState().getActiveFilters("commands")).toStrictEqual({
      BCU: [1, 2],
      PCU: [3],
    });
  });

  it("restores all telemetry IDs after a clear", () => {
    store.getState().clearFilters("telemetry");
    store.getState().selectAllFilters("telemetry");

    expect(store.getState().getActiveFilters("telemetry")).toStrictEqual({
      BCU: [10, 20],
      PCU: [30],
    });
  });

  it("does not affect the other scope", () => {
    store.getState().clearFilters("commands");
    const telemetryBefore = store.getState().getActiveFilters("telemetry");

    store.getState().selectAllFilters("commands");

    expect(store.getState().getActiveFilters("telemetry")).toStrictEqual(
      telemetryBefore,
    );
  });
});

// ─── clearFilters ─────────────────────────────────────────────────────────────

describe("clearFilters", () => {
  it("empties all command category arrays", () => {
    store.getState().clearFilters("commands");

    expect(store.getState().getActiveFilters("commands")).toStrictEqual({
      BCU: [],
      PCU: [],
    });
  });

  it("empties all telemetry category arrays", () => {
    store.getState().clearFilters("telemetry");

    expect(store.getState().getActiveFilters("telemetry")).toStrictEqual({
      BCU: [],
      PCU: [],
    });
  });

  it("does not affect the other scope", () => {
    const commandsBefore = store.getState().getActiveFilters("commands");
    store.getState().clearFilters("telemetry");

    expect(store.getState().getActiveFilters("commands")).toStrictEqual(
      commandsBefore,
    );
  });
});

// ─── toggleItemFilter ─────────────────────────────────────────────────────────

describe("toggleItemFilter", () => {
  it("removes an ID that is currently selected", () => {
    store.getState().toggleItemFilter("commands", "BCU", 1);

    expect(
      store.getState().getActiveFilters("commands")?.["BCU"],
    ).not.toContain(1);
  });

  it("adds an ID that is not currently selected", () => {
    store.getState().clearFilters("commands");
    store.getState().toggleItemFilter("commands", "BCU", 1);

    expect(store.getState().getActiveFilters("commands")?.["BCU"]).toContain(1);
  });

  it("does not affect other categories", () => {
    const pcuBefore = store.getState().getActiveFilters("commands")?.["PCU"];
    store.getState().toggleItemFilter("commands", "BCU", 1);

    expect(
      store.getState().getActiveFilters("commands")?.["PCU"],
    ).toStrictEqual(pcuBefore);
  });

  it("does not affect the other scope", () => {
    const telemetryBefore = store.getState().getActiveFilters("telemetry");
    store.getState().toggleItemFilter("commands", "BCU", 1);

    expect(store.getState().getActiveFilters("telemetry")).toStrictEqual(
      telemetryBefore,
    );
  });
});

// ─── toggleCategoryFilter ─────────────────────────────────────────────────────

describe("toggleCategoryFilter", () => {
  it("checked=true selects all IDs in the commands category", () => {
    store.getState().clearFilters("commands");
    store.getState().toggleCategoryFilter("commands", "BCU", true);

    expect(
      store.getState().getActiveFilters("commands")?.["BCU"],
    ).toStrictEqual([1, 2]);
  });

  it("checked=true selects all IDs in the telemetry category", () => {
    store.getState().clearFilters("telemetry");
    store.getState().toggleCategoryFilter("telemetry", "BCU", true);

    expect(
      store.getState().getActiveFilters("telemetry")?.["BCU"],
    ).toStrictEqual([10, 20]);
  });

  it("checked=false clears all IDs in the category", () => {
    store.getState().toggleCategoryFilter("commands", "BCU", false);

    expect(
      store.getState().getActiveFilters("commands")?.["BCU"],
    ).toStrictEqual([]);
  });

  it("does not affect other categories", () => {
    const pcuBefore = store.getState().getActiveFilters("commands")?.["PCU"];
    store.getState().toggleCategoryFilter("commands", "BCU", false);

    expect(
      store.getState().getActiveFilters("commands")?.["PCU"],
    ).toStrictEqual(pcuBefore);
  });
});
