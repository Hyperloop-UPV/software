import type { Measurement } from "./Packet";

export type TelemetryState = Record<number, TelemetryPacket>;

export interface TelemetryPacket {
  count: number;
  cycleTime: number;
  hexValue: string;
  id: number;
  measurementUpdates: Measurement[];
}

export type TelemtryData = Record<number, TelemetryPacket>;
