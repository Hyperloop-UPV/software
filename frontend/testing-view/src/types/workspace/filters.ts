import type { BoardName } from "../data/board";
import type { SidebarTab } from "./sidebar";

export type FilterScope = SidebarTab | "logs";

export type TabFilter = Record<BoardName, number[]>;

export type WorkspaceFilters = Record<FilterScope, TabFilter>;
