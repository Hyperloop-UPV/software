import type { BoardName } from "./BoardName";

export type PacketsBoardName = BoardName | "HVSCU-Cabinet";

type FilterKey = string;
export type CommandsFilterKey = BoardName;
export type PacketsFilterKey = PacketsBoardName;

export type TabFilter<T extends FilterKey> = Record<T, string[]>;
