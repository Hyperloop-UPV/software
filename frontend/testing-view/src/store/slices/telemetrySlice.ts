import type { StateCreator } from "zustand";
import type { Store } from "../store";
import type { TelemetryData } from "../../types/Telemetry";

export interface TelemetrySlice {
  telemetry: TelemetryData[];
  addTelemetry: (data: TelemetryData) => void;
}

export const createTelemetrySlice: StateCreator<
  Store,
  [],
  [],
  TelemetrySlice
> = (set) => ({
  telemetry: [] as TelemetryData[],
  addTelemetry: (data) =>
    set((state) => ({
      telemetry: [...state.telemetry, data],
    })),
});
