import type { BoardName } from "./board";

/**
 * Defines current moment in time.\
 * **Be careful** as there is no way to check if a timestamp is unique.\
 * Because seconds basically don't tell us anything in the context of high-frequency systems
 * and counter only means uniqueness considering the same packet type
 */
export interface MessageTimestamp {
  /** Counter which is incremented by 1 every time packet of one type is generated,\
   * but it can be the same between different packet types
   */
  counter: number;
  second: number;
  minute: number;
  hour: number;
  day: number;
  month: number;
  year: number;
}

/**
 * Possible payloads for a `ok`, `warning` and `fault` messages.
 */
export type DetailedPayload =
  | {
      kind: "LOWER_BOUND" | "UPPER_BOUND";
      data: { bound: number; value: number };
    }
  | { kind: "OUT_OF_BOUNDS"; data: { bounds: [number, number]; value: number } }
  | { kind: "EQUALS"; data: { value: number } }
  | { kind: "NOT_EQUALS"; data: { want: number; value: number } }
  | {
      kind: "TIME_ACCUMULATION";
      data: { value: number; bound: number; timelimit: number };
    }
  | { kind: "ERROR_HANDLER" | "WARNING"; data: string };

/**
 * Definition of a MessagePacket as it arrives from the backend.
 */
export interface MessagePacket {
  /** Message type */
  kind: "info" | "warning" | "fault" | "ok";
  /** For `info` messages, the payload is a string.
   * For `warning`, `fault` and `ok` messages, the payload is a DetailedPayload.
   */
  payload: string | DetailedPayload;
  board: BoardName;
  name: string;
  timestamp: MessageTimestamp;
}

/**
 * Message definition on frontend.
 */
export interface Message extends MessagePacket {
  /** Unique message id generated on frontend for React keys */
  id: string;
}
