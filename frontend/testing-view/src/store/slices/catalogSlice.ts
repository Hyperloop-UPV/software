import type { StateCreator } from "zustand";
import type { BoardName } from "../../types/BoardName";
import type { Item } from "../../types/Item";

export interface CatalogSlice {
  commands: Record<BoardName, Item[]>;
  setCommands: (commands: Record<BoardName, Item[]>) => void;

  packets: Record<BoardName, Item[]>;
  setPackets: (packets: Record<BoardName, Item[]>) => void;
}

export const createCatalogSlice: StateCreator<CatalogSlice> = (set) => ({
  commands: {} as Record<BoardName, Item[]>,
  packets: {} as Record<BoardName, Item[]>,
  setCommands: (commands) => set({ commands }),
  setPackets: (packets) => set({ packets }),
});
