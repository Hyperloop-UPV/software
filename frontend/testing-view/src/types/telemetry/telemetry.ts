import type { TelemetryPacket } from "@workspace/core";

export type TelemetryData = Record<number, TelemetryPacket>;

export type TelemetryState = Record<number, TelemetryPacket>;
