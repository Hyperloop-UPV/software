import type { CommandCatalogItem } from "./commandCatalogItem";
import type { TelemetryCatalogItem } from "./telemetryCatalogItem";

export type BoardName = string;
export interface BoardData {
  name: BoardName;
}

export interface BoardOrdersData extends BoardData {
  orders: CommandCatalogItem[];
}

export interface BoardPacketsData extends BoardData {
  packets: TelemetryCatalogItem[];
}
