import { beforeEach, describe, expect, it } from "vitest";
import { BOARDS, createTestStore, seedStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
  seedStore(store);
});

// ─── isItemExpanded / toggleExpandedItem ──────────────────────────────────────

describe("isItemExpanded", () => {
  it("is false by default", () => {
    expect(store.getState().isItemExpanded("telemetry", "board", "BCU")).toBe(
      false,
    );
  });
});

describe("toggleExpandedItem", () => {
  it("expands a collapsed item", () => {
    store.getState().toggleExpandedItem("telemetry", "board", "BCU");

    expect(store.getState().isItemExpanded("telemetry", "board", "BCU")).toBe(
      true,
    );
  });

  it("collapses an already-expanded item", () => {
    store.getState().toggleExpandedItem("telemetry", "board", "BCU");
    store.getState().toggleExpandedItem("telemetry", "board", "BCU");

    expect(store.getState().isItemExpanded("telemetry", "board", "BCU")).toBe(
      false,
    );
  });

  it("does not expand other items in the same scope", () => {
    store.getState().toggleExpandedItem("telemetry", "board", "BCU");

    expect(store.getState().isItemExpanded("telemetry", "board", "PCU")).toBe(
      false,
    );
  });

  it("is scoped — expanding in 'telemetry' does not affect 'commands'", () => {
    store.getState().toggleExpandedItem("telemetry", "board", "BCU");

    expect(store.getState().isItemExpanded("commands", "board", "BCU")).toBe(
      false,
    );
  });
});

// ─── getFlattenedRows ─────────────────────────────────────────────────────────

describe("getFlattenedRows", () => {
  it("returns only board rows when all boards are collapsed", () => {
    const rows = store.getState().getFlattenedRows("telemetry", BOARDS);

    expect(rows.every((r) => r.type === "board")).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it("returns correct board row shape", () => {
    const rows = store.getState().getFlattenedRows("telemetry", BOARDS);

    expect(rows[0]).toMatchObject({ type: "board", id: "BCU", count: 2 });
    expect(rows[1]).toMatchObject({ type: "board", id: "PCU", count: 1 });
  });

  it("includes packet rows under an expanded board", () => {
    store.getState().toggleExpandedItem("telemetry", "board", "BCU");

    const rows = store.getState().getFlattenedRows("telemetry", BOARDS);
    const types = rows.map((r) => r.type);

    expect(types).toContain("packet");
    // BCU board header + 2 BCU packets + PCU board header
    expect(rows).toHaveLength(4);
  });

  it("packet rows appear after their board header", () => {
    store.getState().toggleExpandedItem("telemetry", "board", "BCU");

    const rows = store.getState().getFlattenedRows("telemetry", BOARDS);

    expect(rows[0]).toMatchObject({ type: "board", id: "BCU" });
    expect(rows[1].type).toBe("packet");
    expect(rows[2].type).toBe("packet");
    expect(rows[3]).toMatchObject({ type: "board", id: "PCU" });
  });

  it("skips boards with no filtered items", () => {
    store.getState().toggleCategoryFilter("telemetry", "PCU", false);

    const rows = store.getState().getFlattenedRows("telemetry", BOARDS);

    expect(rows.some((r) => r.id === "PCU")).toBe(false);
  });

  it("reflects commands catalog when scope is 'commands'", () => {
    const rows = store.getState().getFlattenedRows("commands", BOARDS);

    expect(rows[0]).toMatchObject({ type: "board", id: "BCU", count: 2 });
    expect(rows[1]).toMatchObject({ type: "board", id: "PCU", count: 1 });
  });
});
