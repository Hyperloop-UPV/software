import type { Command } from "./command";
import type { Packet } from "./packet";

export type BoardName = string;
export interface BoardData {
  name: BoardName;
}

export interface BoardOrdersData extends BoardData {
  orders: Command[];
}

export interface BoardPacketsData extends BoardData {
  packets: Packet[];
}
