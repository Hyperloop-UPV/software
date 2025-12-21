import type { StateCreator } from "zustand";

// Define your telemetry type here - for now using a generic structure
// You can replace this with your actual telemetry type later
export type TelemetryData = Record<string, unknown>;

export interface TelemetrySlice {
  telemetry: TelemetryData[];
  addTelemetry: (data: TelemetryData) => void;
}

export const createTelemetrySlice: StateCreator<TelemetrySlice> = (set) => ({
  telemetry: [] as TelemetryData[],
  addTelemetry: (data) =>
    set((state) => ({
      telemetry: [...state.telemetry, data],
    })),
});
