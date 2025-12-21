import type { SidebarTab } from "./SidebarTab";
import type { TabFilter } from "./TabFilter";

export type FilterScope = SidebarTab | "logs";

export type WorkspaceFilters = Record<FilterScope, TabFilter>;
export type WorkspaceExpandedItems = Record<FilterScope, Set<number | string>>;
