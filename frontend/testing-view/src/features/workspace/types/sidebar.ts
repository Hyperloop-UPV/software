import type { FilterScope } from "./filters";

/**
 * Sidebar tab identifiers.
 */
export type SidebarTab = "commands" | "telemetry";

/**
 * Record of expanded items per filter scope.
 */
export type WorkspaceExpandedItems = Record<FilterScope, Set<number | string>>;
