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
 * The modules this package ships a color for.
 */
export type KnownLoggerModule =
  | "testing-view"
  | "competition-view"
  | "logging-view"
  | "flashing-view"
  | "adj-view"
  | "core"
  | "ui";

/**
 * A logger module name. Any string is accepted, so an app built on top of this
 * package can register its own module; the `KnownLoggerModule` members keep
 * their autocomplete and their built-in color.
 */
export type LoggerModule = KnownLoggerModule | (string & {});

/**
 * Connection settings for the `socketService`.
 *
 * When `url` is given it wins over every other field. Otherwise the URL is
 * built as `${secure ? "wss" : "ws"}://${host}:${port}${path}`.
 */
export interface SocketConfig {
  /** Complete WebSocket URL, e.g. "wss://pod.hyperloopupv.com/backend". */
  url?: string;

  /** Hostname or IP. Defaults to "127.0.0.1". */
  host?: string;

  /** Port. Defaults to 4000. */
  port?: number;

  /** Path, leading slash included. Defaults to "/backend". */
  path?: string;

  /** Use wss:// instead of ws://. Defaults to false. */
  secure?: boolean;

  /** Heartbeat period in milliseconds. 0 disables it. Defaults to 1000. */
  heartbeatIntervalMs?: number;
}
