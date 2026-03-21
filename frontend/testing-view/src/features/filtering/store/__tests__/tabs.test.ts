import { beforeEach, describe, expect, it } from "vitest";
import { createTestStore } from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
});

describe("getActiveTab / setActiveTab", () => {
  it("defaults to 'commands'", () => {
    expect(store.getState().getActiveTab()).toBe("commands");
  });

  it("returns the tab set for the active workspace", () => {
    store.getState().setActiveTab("telemetry");
    expect(store.getState().getActiveTab()).toBe("telemetry");
  });

  it("is scoped to the active workspace", () => {
    store.getState().setActiveTab("logs");

    const workspace2 = store.getState().workspaces[1];
    store.getState().setActiveWorkspace(workspace2);

    expect(store.getState().getActiveTab()).toBe("commands");
  });

  it("each workspace retains its own tab independently", () => {
    store.getState().setActiveTab("telemetry");

    const workspace2 = store.getState().workspaces[1];
    store.getState().setActiveWorkspace(workspace2);
    store.getState().setActiveTab("logs");

    const workspace1 = store.getState().workspaces[0];
    store.getState().setActiveWorkspace(workspace1);

    expect(store.getState().getActiveTab()).toBe("telemetry");
  });
});
