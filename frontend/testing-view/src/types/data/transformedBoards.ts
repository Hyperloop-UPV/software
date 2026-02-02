import type { BoardName, BoardOrdersData, BoardPacketsData } from "./board";
import type { CommandCatalogItem } from "./commandCatalogItem";
import type { TelemetryCatalogItem } from "./telemetryCatalogItem";

// Packets fetching return data type
export interface PacketsData {
  boards: BoardPacketsData[];
}

// Commands fetching return data type
export interface OrdersData {
  boards: BoardOrdersData[];
}

export interface TransformedBoards {
  telemetryCatalog: Record<string, TelemetryCatalogItem[]>;
  commandsCatalog: Record<string, CommandCatalogItem[]>;
  boards: Set<BoardName>;
}
