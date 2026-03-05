import type { StateCreator } from "zustand";
import type { CatalogItem } from "../../types/common/item";
import type { BoardName } from "../../types/data/board";
import type { Store } from "../store";

export interface CatalogSlice {
  // Commands catalog
  commandsCatalog: Record<BoardName, CatalogItem[]>;
  setCommandsCatalog: (
    commandsCatalog: Record<BoardName, CatalogItem[]>,
  ) => void;

  // Telemetry catalog
  telemetryCatalog: Record<BoardName, CatalogItem[]>;
  setTelemetryCatalog: (
    telemetryCatalog: Record<BoardName, CatalogItem[]>,
  ) => void;

  // Boards
  boards: BoardName[];
  setBoards: (boards: BoardName[]) => void;
}

export const createCatalogSlice: StateCreator<Store, [], [], CatalogSlice> = (
  set,
) => ({
  commandsCatalog: {} as Record<BoardName, CatalogItem[]>,
  telemetryCatalog: {} as Record<BoardName, CatalogItem[]>,
  setCommandsCatalog: (commandsCatalog) => set({ commandsCatalog }),
  setTelemetryCatalog: (telemetryCatalog) => set({ telemetryCatalog }),
  boards: [] as BoardName[],
  setBoards: (boards) => set({ boards }),
});
