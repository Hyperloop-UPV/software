import type { FilterScope } from "./filters";

export type SidebarTab = "commands" | "packets";

export type WorkspaceExpandedItems = Record<FilterScope, Set<number | string>>;
