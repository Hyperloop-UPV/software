export type { TelemetryPacket, VariableValue, Variables } from "@hyperloop-upv/frontend-kit/core";

/**
 * The backend sends a batch of packets keyed by numeric packet ID.
 * Each packet carries its own `measurementUpdates` map.
 */
export type TelemetryData = Record<number, import("@hyperloop-upv/frontend-kit/core").TelemetryPacket>;

/**
 * Telemetry keyed first by board name then by measurement ID.
 * Two-level lookup prevents collisions between boards that share
 * measurement names (e.g. VCU and LCU both have "general_state").
 */
export type TelemetryState = Record<string, Record<string, number | boolean | string>>;
