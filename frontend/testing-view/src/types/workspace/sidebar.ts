import type { FilterScope } from "./filters";

export type SidebarTab = "commands" | "telemetry";

export type WorkspaceExpandedItems = Record<FilterScope, Set<number | string>>;
