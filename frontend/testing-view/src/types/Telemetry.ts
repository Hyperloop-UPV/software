export type TelemetryState = Record<number, TelemetryPacket>;

export type Variables = Record<
  string,
  { last: number; average: number } | boolean | string | number
>;

export interface TelemetryPacket {
  count: number;
  cycleTime: number;
  hexValue: string;
  id: number;
  measurementUpdates: Variables;
}

export type TelemtryData = Record<number, TelemetryPacket>;
