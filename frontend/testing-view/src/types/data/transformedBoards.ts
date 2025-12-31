import type { BoardName, BoardOrdersData, BoardPacketsData } from "./board";
import type { Command } from "./command";
import type { Packet } from "./packet";

export interface PacketsData {
  boards: BoardPacketsData[];
}

export interface OrdersData {
  boards: BoardOrdersData[];
}

export interface TransformedBoards {
  packets: Record<string, Packet[]>;
  commands: Record<string, Command[]>;
  boards: Set<BoardName>;
}
