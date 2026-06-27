/** Single variable value as received from the backend. */
export type VariableValue =
  | { last: number; average: number }
  | boolean
  | string
  | number;

/** Map of variable names to their current values inside a packet. */
export type Variables = Record<string, VariableValue>;

/** High-frequency telemetry packet from the backend. */
export interface TelemetryData {
  id: number;
  count: number;
  cycleTime: number;
  hexValue: string;
  measurementUpdates: Variables;
}

/**
 * Flat map from measurement ID (string) to the latest numeric value.
 * The store keeps only the most recent value per measurement to avoid
 * unbounded memory growth.
 */
export type TelemetryState = Record<string, number | boolean | string>;
