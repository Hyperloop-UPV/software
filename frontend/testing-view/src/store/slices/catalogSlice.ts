import type { StateCreator } from "zustand";
import type { Item } from "../../types/common/item";
import type { BoardName } from "../../types/data/board";
import type { Store } from "../store";

export interface CatalogSlice {
  // Commands catalog
  commands: Record<BoardName, Item[]>;
  setCommands: (commands: Record<BoardName, Item[]>) => void;

  // Packets catalog
  packets: Record<BoardName, Item[]>;
  setPackets: (packets: Record<BoardName, Item[]>) => void;
}

export const createCatalogSlice: StateCreator<Store, [], [], CatalogSlice> = (
  set,
) => ({
  commands: {} as Record<BoardName, Item[]>,
  packets: {} as Record<BoardName, Item[]>,
  setCommands: (commands) => set({ commands }),
  setPackets: (packets) => set({ packets }),
});
