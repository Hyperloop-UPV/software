import type { TelemetryPacket } from "@hyperloopupv/frontend-kit/core";

/**
 * Map of telemetry packets per telemetry packetid.
 */
export type TelemetryData = Record<number, TelemetryPacket>;

/**
 * Full map of telemetry packets per telemetry packetid.\
 * This is not the same type as TelemetryData conceptually, but they match.
 */
export type TelemetryState = Record<number, TelemetryPacket>;
