import type { BoardName } from "./BoardName";
import type { Command } from "./Command";
import type { Packet } from "./Packet";

export interface BoardData {
  name: BoardName;
}

export interface BoardOrdersData extends BoardData {
  orders: Command[];
}

export interface BoardPacketsData extends BoardData {
  packets: Packet[];
}

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
