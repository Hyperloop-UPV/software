// Types for the ADJ archive fetched from GitHub Pages and the log session state.

export interface AdjMeasurement {
  id: string;
  name: string;
  type: string;
  podUnits?: string;
  displayUnits?: string;
  enumValues?: string[];
}

export interface AdjPacket {
  id: number;
  name: string;
  // "data" packets carry telemetry; "order" packets are commands sent to a board.
  type: "data" | "order" | string;
  variables: string[];
  period?: number;
  period_type?: string;
  socket?: string;
}

// The inner board config object stored under the board's own name key.
export interface AdjBoardInfo {
  board_id: number;
  board_ip: string;
  // Path references to definition files — not embedded objects.
  measurements: string[];
  packets: string[];
}

// boards[boardName] is a nested group, not a flat object.
// Keys: boardName (AdjBoardInfo), `${boardName}_measurements` (AdjMeasurement[]),
//       "packets", "packets_old", "orders", "orders_old" (AdjPacket[]).
export type AdjBoardGroup = Record<string, AdjBoardInfo | AdjMeasurement[] | AdjPacket[] | unknown>;

export interface AdjArchive {
  boards: Record<string, AdjBoardGroup>;
  general_info: {
    ports: Record<string, number>;
    addresses: Record<string, string>;
    // Unit conversion expressions (e.g. "/1000" to convert mm→m). CONVERSION ALREADY MADE BY THE BACKEND.
    units: Record<string, string>;
    message_ids: Record<string, number>;
  };
}

// Parsed content of logger_settings.json written by the backend at session start.
export interface LoggerSettings {
  adj_commit_hash: string;
  // Timestamp unit used for all CSV relative timestamps: "ns" | "us" | "ms" | "s"
  time_unit: string;
  date: string;
}

// Overall session-open outcome: "ok" = settings parsed; "degraded" = settings
// missing/malformed but CSVs were found (session still opens, CSV-only); "error" =
// neither settings nor CSVs found.
export type SessionStatusLevel = "ok" | "degraded" | "error";

// ADJ archive fetch outcome — only checked when settings parsed (adj_commit_hash comes
// from there). Layered on top of SessionStatus.level, never downgrades it.
export interface AdjStatus {
  ok: boolean;
  message: string | null; // null when ok === true
}

export interface SessionStatus {
  level: SessionStatusLevel;
  message: string;
  adj: AdjStatus | null; // null = not checked
}

// Key format used to uniquely identify a measurement across boards: "BOARD/measurementId"
export type SeriesKey = string;

// Minimal file interface used by openSession — satisfied by both native File objects
// (from <input webkitdirectory>) and synthetic entries built from a directory drop.
export interface DroppedFile {
  name: string;
  webkitRelativePath: string;
  text: () => Promise<string>;
}

/** An order emitted by the backend during a logging session. Times are
 * normalized to milliseconds, matching plotted telemetry signals. */
export interface LoggedOrder {
  id: string;
  time: number;
  from: string;
  to: string;
  orderId: number;
  parameters: Record<string, unknown> | null;
  /** Resolved from the session ADJ when it is available. */
  name: string;
}
