import type { CommandCatalogItem } from "./commandCatalogItem";
import type { TelemetryCatalogItem } from "./telemetryCatalogItem";

/**
 * Name of a board, like LCU or HVBMS.\
 * I decided not to use array of predefined strings in case a new board is added in the future.
 */
export type BoardName = string;

/**
 * Common properties of boards.
 */
export interface BoardData {
  name: BoardName;
}

/**
 * Basically ADJ telemetry packets definition from the backend.
 */
export interface BoardPacketsData extends BoardData {
  /** List of telemetry packets (also referred as packets in some places) */
  packets: TelemetryCatalogItem[];
}

/**
 * Basically ADJ commands definition from the backend.
 */
export interface BoardOrdersData extends BoardData {
  /** List of commands (also referred as orders in some places) */
  orders: CommandCatalogItem[];
}

/**
 * Final type of the result of the packets fetching.
 */
export interface PacketsData {
  boards: BoardPacketsData[];
}

/**
 * Final type of the result of the commands fetching.
 */
export interface OrdersData {
  boards: BoardOrdersData[];
}
