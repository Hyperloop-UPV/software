import type { BoardName } from "./BoardName";
import type { PacketsBoardName } from "./PacketsBoardName";

export type FilterKey = string;
export type CommandsFilterKey = BoardName;
export type PacketsFilterKey = PacketsBoardName;

export type TabFilter<T extends FilterKey> = Record<T, string[]>;
