import type { BoardName } from "../../../types/data/board";
import type { SidebarTab } from "../../workspace/types/sidebar";

/**
 * Filter scope identifiers.
 * **Be careful** don't confuse this one with sidebar tabs.
 */
export type FilterScope = SidebarTab | "logs";

/**
 * Record of filtered items ids per board.
 */
export type TabFilter = Record<BoardName, number[]>;

/**
 * Record of filtered items ids per filter scope.
 */
export type WorkspaceFilters = Record<FilterScope, TabFilter>;
