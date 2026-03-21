import { beforeEach, describe, expect, it } from "vitest";
import { createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
});

describe("filterDialog", () => {
  it("is closed by default", () => {
    expect(store.getState().filterDialog).toStrictEqual({
      isOpen: false,
      scope: null,
    });
  });

  it("opens with the given scope", () => {
    store.getState().openFilterDialog("commands");

    expect(store.getState().filterDialog).toStrictEqual({
      isOpen: true,
      scope: "commands",
    });
  });

  it("can open with 'telemetry' scope", () => {
    store.getState().openFilterDialog("telemetry");

    expect(store.getState().filterDialog).toStrictEqual({
      isOpen: true,
      scope: "telemetry",
    });
  });

  it("closes and clears the scope", () => {
    store.getState().openFilterDialog("commands");
    store.getState().closeFilterDialog();

    expect(store.getState().filterDialog).toStrictEqual({
      isOpen: false,
      scope: null,
    });
  });
});
