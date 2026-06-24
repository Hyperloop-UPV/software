export type { TelemetryPacket, VariableValue, Variables } from "@workspace/core";

/**
 * The backend sends a batch of packets keyed by numeric packet ID.
 * Each packet carries its own `measurementUpdates` map.
 */
export type TelemetryData = Record<number, import("@workspace/core").TelemetryPacket>;

/**
 * Flat map from measurement ID (string) to the latest value.
 * The store keeps only the most recent value per measurement to avoid
 * unbounded memory growth.
 */
export type TelemetryState = Record<string, number | boolean | string>;
