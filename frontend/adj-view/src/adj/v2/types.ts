// Types for an ADJ v2 archive fetched from GitHub Pages.

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

// A board's network socket. The ADJ schema (adj repo,
// .github/workflows/scripts/adj-tester/schema/socket.schema.json) allows three types:
// - ServerSocket (TCP server): `port`. No remote_ip — the board listens, and the
//   archive doesn't record who connects.
// - DatagramSocket (UDP): `port`, `remote_ip`.
// - Socket (TCP client): `local_port`, `remote_ip`, `remote_port`.
// remote_ip is a raw IP or a key from general_info.addresses (e.g. "backend").
export interface AdjSocket {
  type: string;
  name: string;
  port?: number;
  local_port?: number;
  remote_ip?: string;
  remote_port?: number;
}

// boards[boardName] is a nested group, not a flat object.
// Keys: boardName (AdjBoardInfo), `${boardName}_measurements` (AdjMeasurement[]),
//       "packets", "packets_old", "orders", "orders_old" (AdjPacket[]), "sockets" (AdjSocket[]).
export type AdjBoardGroup = Record<string, AdjBoardInfo | AdjMeasurement[] | AdjPacket[] | AdjSocket[] | unknown>;

export interface AdjArchiveV2 {
  boards: Record<string, AdjBoardGroup>;
  general_info: {
    ports: Record<string, number>;
    addresses: Record<string, string>;
    // Unit conversion expressions (e.g. "/1000" to convert mm→m). CONVERSION ALREADY MADE BY THE BACKEND.
    units: Record<string, string>;
    message_ids: Record<string, number>;
  };
}
