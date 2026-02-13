import type { BoardName } from "./board";
import type { CommandCatalogItem } from "./commandCatalogItem";
import type { TelemetryCatalogItem } from "./telemetryCatalogItem";

/**
 * Final result of the useBoardData hook and boards transformation.\
 * This is the format I actually use
 */
export interface TransformedBoards {
  /** Map of board name to list of telemetry catalog items */
  telemetryCatalog: Record<BoardName, TelemetryCatalogItem[]>;

  /** Map of board name to list of command catalog items */
  commandsCatalog: Record<BoardName, CommandCatalogItem[]>;

  /** Set of all available boards (not used for now) */
  boards: Set<BoardName>;
}
