import type { BoardName } from "../types/BoardName";
import type { PacketsBoardName } from "../types/PacketsBoardName";

export const BOARD_NAMES: BoardName[] = [
  "BCU",
  "PCU",
  "LCU",
  "HVSCU",
  "BMSL",
  "VCU",
];

export const PACKET_BOARD_NAMES: PacketsBoardName[] = [
  ...BOARD_NAMES,
  "HVSCU-Cabinet",
];
