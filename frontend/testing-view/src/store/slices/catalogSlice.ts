import type { StateCreator } from "zustand";
import type { Item } from "../../types/common/item";
import type { BoardName } from "../../types/data/board";
import type { Store } from "../store";

export interface CatalogSlice {
  // Commands catalog
  commandsCatalog: Record<BoardName, Item[]>;
  setCommandsCatalog: (commandsCatalog: Record<BoardName, Item[]>) => void;

  // Telemetry catalog
  telemetryCatalog: Record<BoardName, Item[]>;
  setTelemetryCatalog: (telemetryCatalog: Record<BoardName, Item[]>) => void;
}

export const createCatalogSlice: StateCreator<Store, [], [], CatalogSlice> = (
  set,
) => ({
  commandsCatalog: {} as Record<BoardName, Item[]>,
  telemetryCatalog: {} as Record<BoardName, Item[]>,
  setCommandsCatalog: (commandsCatalog) => set({ commandsCatalog }),
  setTelemetryCatalog: (telemetryCatalog) => set({ telemetryCatalog }),
});
