import type { StateCreator } from "zustand";
import type { TelemetryData, TelemetryState } from "../../types/Telemetry";
import type { Store } from "../store";

export interface TelemetrySlice {
  telemetry: TelemetryState;
  addTelemetry: (data: TelemetryData) => void;
}

export const createTelemetrySlice: StateCreator<
  Store,
  [],
  [],
  TelemetrySlice
> = (set) => ({
  telemetry: {} as TelemetryState,
  addTelemetry: (data) =>
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        ...data,
      },
    })),
});
