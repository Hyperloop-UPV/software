import type { StateCreator } from "zustand";
import type {
  TelemetryData,
  TelemetryState,
} from "../../types/telemetry/telemetry";
import type { Store } from "../store";

export interface TelemetrySlice {
  telemetry: TelemetryState;
  addTelemetry: (data: TelemetryData) => void;
}

export const createTelemetrySlice: StateCreator<
  Store,
  [], // [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  TelemetrySlice
> = (set) => ({
  telemetry: {} as TelemetryState,
  addTelemetry: (data) =>
    set(
      (state) => {
        const newTelemetry = { ...state.telemetry, ...data };
        // const size = Object.keys(newTelemetry).length;

        // console.log(
        //   `📦 Telemetry packets: ${size}, New: ${Object.keys(data).length}`,
        // );

        return { telemetry: newTelemetry };
      },
      false,
      // {
      //   type: "telemetry/add",
      //   payload: { packetCount: Object.keys(data).length },
      // },
    ),
});
