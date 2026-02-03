/**
 * Options for the `onTopic` method of the `SocketService` class.
 */
export interface TopicOptions {
  /** The downsampling method to use. */
  downsample?: "min-max" | "none";

  /** The throttle time in milliseconds. */
  throttle?: number;
}

/**
 * The value of a variable in a telemetry packet.
 */
export type VariableValue =
  | { last: number; average: number }
  | boolean
  | string
  | number;

/**
 * The variables of a telemetry packet.
 */
export type Variables = Record<string, VariableValue>;

/**
 * A telemetry packet that arrives in high frequency.\
 * Don't confuse it with the `TelemetryCatalogItem` type.
 */
export interface TelemetryPacket {
  count: number;
  cycleTime: number;
  hexValue: string;
  id: number;
  measurementUpdates: Variables;
}

/**
 * The modules that can be logged to. Used for the `logger` object.
 */
export type LoggerModule = "testing-view" | "competition-view" | "core" | "ui";
