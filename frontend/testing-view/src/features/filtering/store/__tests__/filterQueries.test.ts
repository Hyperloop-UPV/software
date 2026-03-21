import { beforeEach, describe, expect, it } from "vitest";
import type { BoardName } from "../../../../types/data/board";
import { createTestStore, seedStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
  seedStore(store);
});

// ─── getFilteredItems ─────────────────────────────────────────────────────────

describe("getFilteredItems", () => {
  it("returns all command items when all are selected", () => {
    const items = store.getState().getFilteredItems("commands");
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(items).toHaveLength(3);
  });

  it("returns all telemetry items when all are selected", () => {
    const items = store.getState().getFilteredItems("telemetry");
    expect(items.map((i) => i.id)).toEqual(
      expect.arrayContaining([10, 20, 30]),
    );
    expect(items).toHaveLength(3);
  });

  it("returns only selected items when a partial filter is applied", () => {
    store.getState().clearFilters("commands");
    store.getState().toggleItemFilter("commands", "BCU", 1);

    const items = store.getState().getFilteredItems("commands");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(1);
  });

  it("returns empty array when nothing is selected", () => {
    store.getState().clearFilters("commands");
    expect(store.getState().getFilteredItems("commands")).toHaveLength(0);
  });

  it("does not mix commands and telemetry items", () => {
    const commandItems = store.getState().getFilteredItems("commands");
    const telemetryItems = store.getState().getFilteredItems("telemetry");

    const commandIds = commandItems.map((i) => i.id);
    const telemetryIds = telemetryItems.map((i) => i.id);

    expect(commandIds.some((id) => telemetryIds.includes(id))).toBe(false);
  });
});

// ─── getFilteredItemsIds ──────────────────────────────────────────────────────

describe("getFilteredItemsIds", () => {
  it("returns flat list of all selected command IDs", () => {
    const ids = store.getState().getFilteredItemsIds("commands");
    expect(ids).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it("returns flat list of all selected telemetry IDs", () => {
    const ids = store.getState().getFilteredItemsIds("telemetry");
    expect(ids).toEqual(expect.arrayContaining([10, 20, 30]));
  });
});

describe("getFilteredItemsIdsByCategory", () => {
  it("returns IDs only for the given board", () => {
    expect(
      store.getState().getFilteredItemsIdsByCategory("commands", "BCU"),
    ).toStrictEqual([1, 2]);
    expect(
      store.getState().getFilteredItemsIdsByCategory("commands", "PCU"),
    ).toStrictEqual([3]);
  });

  it("returns IDs from the correct catalog for telemetry", () => {
    expect(
      store.getState().getFilteredItemsIdsByCategory("telemetry", "BCU"),
    ).toStrictEqual([10, 20]);
  });
});

// ─── getFilteredCount / getTotalCount ─────────────────────────────────────────

describe("getFilteredCount", () => {
  it("returns total number of selected command IDs", () => {
    expect(store.getState().getFilteredCount("commands")).toBe(3);
  });

  it("decreases when an item is deselected", () => {
    store.getState().toggleItemFilter("commands", "BCU", 1);
    expect(store.getState().getFilteredCount("commands")).toBe(2);
  });
});

describe("getFilteredCountByCategory", () => {
  it("returns count per board for commands", () => {
    expect(
      store.getState().getFilteredCountByCategory("commands", "BCU"),
    ).toBe(2);
    expect(
      store.getState().getFilteredCountByCategory("commands", "PCU"),
    ).toBe(1);
  });

  it("returns count per board for telemetry", () => {
    expect(
      store.getState().getFilteredCountByCategory("telemetry", "BCU"),
    ).toBe(2);
  });
});

describe("getTotalCount", () => {
  it("returns total catalog size for commands", () => {
    expect(store.getState().getTotalCount("commands")).toBe(3);
  });

  it("returns total catalog size for telemetry", () => {
    expect(store.getState().getTotalCount("telemetry")).toBe(3);
  });
});

// ─── getSelectionState ────────────────────────────────────────────────────────

describe("getSelectionState", () => {
  it("returns true when all items in the category are selected", () => {
    expect(store.getState().getSelectionState("commands", "BCU")).toBe(true);
  });

  it("returns false when no items are selected", () => {
    store.getState().clearFilters("commands");
    expect(store.getState().getSelectionState("commands", "BCU")).toBe(false);
  });

  it("returns 'indeterminate' when only some items are selected", () => {
    store.getState().toggleItemFilter("commands", "BCU", 1);
    expect(store.getState().getSelectionState("commands", "BCU")).toBe(
      "indeterminate",
    );
  });

  it("returns false for a board with no catalog items", () => {
    expect(
      store.getState().getSelectionState("commands", "EMPTY" as BoardName),
    ).toBe(false);
  });

  it("works independently for commands and telemetry", () => {
    store.getState().clearFilters("commands");

    expect(store.getState().getSelectionState("commands", "BCU")).toBe(false);
    expect(store.getState().getSelectionState("telemetry", "BCU")).toBe(true);
  });
});
