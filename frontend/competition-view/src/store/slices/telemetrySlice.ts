import type { StateCreator } from "zustand";
import type { TelemetryData, TelemetryState } from "../../types/telemetry";
import type { Store } from "../store";

export interface TelemetrySlice {
  telemetry: TelemetryState;
  updateTelemetry: (packets: TelemetryData) => void;
  getMeasurement: (id: string) => number | boolean | string | undefined;
}

export const createTelemetrySlice: StateCreator<
  Store,
  [],
  [],
  TelemetrySlice
> = (set, get) => ({
  telemetry: {},

  updateTelemetry: (packets) => {
    const flat: TelemetryState = {};

    for (const packet of Object.values(packets)) {
      for (const [key, value] of Object.entries(packet.measurementUpdates)) {
        if (typeof value === "object" && value !== null && "last" in value) {
          flat[key] = value.last;
        } else {
          flat[key] = value as number | boolean | string;
        }
      }
    }

    set((state) => ({ telemetry: { ...state.telemetry, ...flat } }));
  },

  getMeasurement: (id) => get().telemetry[id],
});
