import type { StateCreator } from "zustand";
import type { BoardOrdersData } from "../../types/catalog";
import type { Store } from "../store";

export interface CatalogSlice {
  /** Commands grouped by board name, populated on connection. */
  commandsCatalog: Record<string, BoardOrdersData>;
  setCommandsCatalog: (catalog: Record<string, BoardOrdersData>) => void;

  /** Sorted list of board names that have at least one command. */
  boards: string[];
  setBoards: (boards: string[]) => void;
}

export const createCatalogSlice: StateCreator<Store, [], [], CatalogSlice> = (
  set,
) => ({
  commandsCatalog: {},
  setCommandsCatalog: (commandsCatalog) => set({ commandsCatalog }),
  boards: [],
  setBoards: (boards) => set({ boards }),
});
