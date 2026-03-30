import { beforeEach, describe, expect, it } from "vitest";
import {
  COMMANDS_CATALOG,
  TELEMETRY_CATALOG,
  createTestStore,
} from "./helpers";

let store: ReturnType<typeof createTestStore>;

beforeEach(() => {
  store = createTestStore();
  store.getState().setCommandsCatalog(COMMANDS_CATALOG);
  store.getState().setTelemetryCatalog(TELEMETRY_CATALOG);
});

describe("getCatalog", () => {
  it("returns commandsCatalog for 'commands' scope", () => {
    expect(store.getState().getCatalog("commands")).toBe(
      store.getState().commandsCatalog,
    );
  });

  it("returns telemetryCatalog for 'telemetry' scope", () => {
    expect(store.getState().getCatalog("telemetry")).toBe(
      store.getState().telemetryCatalog,
    );
  });

  it("returns telemetryCatalog for 'logs' scope", () => {
    expect(store.getState().getCatalog("logs")).toBe(
      store.getState().telemetryCatalog,
    );
  });
});
