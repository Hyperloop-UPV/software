import type { StateCreator } from "zustand";
import type { Store } from "../store";
import type { TelemetryState, TelemtryData } from "../../types/Telemetry";

export interface TelemetrySlice {
  telemetry: TelemetryState;
  addTelemetry: (data: TelemtryData) => void;
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
