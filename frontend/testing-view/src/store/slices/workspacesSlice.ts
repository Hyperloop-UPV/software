import type { StateCreator } from "zustand";
import { DEFAULT_WORKSPACES } from "../../constants/defaultWorkspaces";
import {
  createEmptyFilter,
  createFullFilter,
  generateInitialFilters,
} from "../../lib/utils";
import type { BoardName } from "../../types/BoardName";
import type { Item } from "../../types/Item";
import type { SidebarTab } from "../../types/SidebarTab";
import type { TabFilter } from "../../types/TabFilter";
import type { Workspace } from "../../types/Workspace";
import type {
  FilterScope,
  WorkspaceExpandedItems,
  WorkspaceFilters,
} from "../../types/Workspaces";
import type { Store } from "../store";

export interface WorkspaceChartSeries {
  packetId: number;
  variable: string;
}

export interface WorkspaceChartConfig {
  id: string;
  series: WorkspaceChartSeries[];
}

export type CheckboxState = boolean | "indeterminate";

export interface WorkspacesSlice {
  // Workspaces
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  setActiveWorkspace: (workspace: Workspace) => void;
  //   removeWorkspace: (id: string) => void;
  //   addWorkspace: (workspace: Workspace) => void;
  getActiveWorkspaceId: () => string | null;

  // Internal helpers
  getCatalog: (scope: FilterScope) => Record<BoardName, Item[]>;

  // Tabs (per workspace)
  activeTab: Record<string, SidebarTab>;
  getActiveTab: () => SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;

  // Filters (per workspace)
  tabFilters: Record<string, WorkspaceFilters>;
  initializeTabFilters: () => void;
  updateFilters: (scope: FilterScope, filters: TabFilter) => void;

  // Helper getters
  getActiveFilters: (scope: FilterScope) => TabFilter | undefined;
  getActiveExpanded: (scope: FilterScope) => Set<number | string> | undefined;

  // Getters for filtered items
  getFilteredItems: (scope: FilterScope) => Item[];
  getFilteredItemsIds: (scope: FilterScope) => number[];
  getFilteredItemsIdsByCategory: (
    scope: FilterScope,
    category: BoardName,
  ) => number[];
  getFilteredItemsByCategory: (
    scope: FilterScope,
    category: BoardName,
  ) => Item[];

  // Stats getters
  getFilteredCount: (scope: FilterScope) => number;
  getFilteredCountByCategory: (
    scope: FilterScope,
    category: BoardName,
  ) => number;
  getTotalCount: (scope: FilterScope) => number;

  // Selection state getters
  getSelectionState: (scope: FilterScope, category: BoardName) => CheckboxState;

  // Filter actions
  selectAllFilters: (scope: FilterScope) => void;
  clearFilters: (scope: FilterScope) => void;
  toggleCategoryFilter: (
    scope: FilterScope,
    category: BoardName,
    checked: boolean,
  ) => void;
  toggleItemFilter: (
    scope: FilterScope,
    category: BoardName,
    id: number,
  ) => void;

  // Expanded items (per workspace)
  expandedItems: Record<string, WorkspaceExpandedItems>;
  isItemExpanded: (scope: SidebarTab, itemId: number | string) => boolean;
  toggleExpandedItem: (scope: SidebarTab, itemId: number | string) => void;

  // Filter dialog
  filterDialog: {
    isOpen: boolean;
    scope: FilterScope | null;
  };
  openFilterDialog: (scope: FilterScope) => void;
  closeFilterDialog: () => void;

  // Telemetry Charts
  charts: Record<string, WorkspaceChartConfig[]>;
  setCharts: (charts: Record<string, WorkspaceChartConfig[]>) => void;
  getActiveWorkspaceCharts: () => WorkspaceChartConfig[];
  addChart: (workspaceId: string) => string;
  removeChart: (workspaceId: string, chartId: string) => void;
  addSeriesToChart: (
    workspaceId: string,
    chartId: string,
    series: WorkspaceChartSeries,
  ) => void;
  removeSeriesFromChart: (
    workspaceId: string,
    chartId: string,
    variable: string,
  ) => void;
}

export const createWorkspacesSlice: StateCreator<
  Store,
  [],
  [],
  WorkspacesSlice
> = (set, get) => ({
  // Workspaces
  activeWorkspace: DEFAULT_WORKSPACES[0],
  workspaces: DEFAULT_WORKSPACES,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  //   removeWorkspace: (id) =>
  //     set((state) => {
  //       const newWorkspaces = state.workspaces.filter(
  //         (workspace) => workspace.id !== id,
  //       );
  //       const newActiveWorkspace =
  //         state.activeWorkspace?.id === id
  //           ? newWorkspaces[0] || null
  //           : state.activeWorkspace;

  //       // Clean up workspace-specific data when removing
  //       const newTabFilters = { ...state.tabFilters };
  //       const newExpandedItems = { ...state.expandedItems };
  //       const newActiveTabs = { ...state.activeTab };
  //       delete newTabFilters[id];
  //       delete newExpandedItems[id];
  //       delete newActiveTabs[id];

  //       return {
  //         workspaces: newWorkspaces,
  //         activeWorkspace: newActiveWorkspace,
  //         tabFilters: newTabFilters,
  //         expandedItems: newExpandedItems,
  //         activeTab: newActiveTabs,
  //       };
  //     }),
  getActiveWorkspaceId: () => {
    const activeWorkspace = get().activeWorkspace;
    return activeWorkspace?.id ?? null;
  },

  // Internal helpers
  getCatalog: (scope: FilterScope) => {
    const catalogKey = scope === "logs" ? "packets" : scope;
    return get()[catalogKey] as Record<BoardName, Item[]>;
  },

  // Tabs (per workspace)
  activeTab: {},
  getActiveTab: () => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return "commands";
    return get().activeTab[activeWorkspaceId] || "commands";
  },
  setActiveTab: (tab) => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    set((state) => ({
      activeTab: { ...state.activeTab, [activeWorkspaceId]: tab },
    }));
  },

  // Filters (per workspace)
  tabFilters: {},
  initializeTabFilters: () => {
    const commands = get().commands;
    const packets = get().packets;

    set({
      tabFilters: generateInitialFilters({
        commands: createFullFilter(commands),
        packets: createFullFilter(packets),
        logs: createFullFilter(packets),
      }),
    });
  },
  updateFilters: (scope, filters) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    set((state) => ({
      tabFilters: {
        ...state.tabFilters,
        [workspaceId]: {
          ...(state.tabFilters[workspaceId] || {}),
          [scope]: filters,
        },
      },
    }));
  },

  // Helper getters
  getActiveFilters: (scope) => {
    const id = get().getActiveWorkspaceId();
    return id ? get().tabFilters[id]?.[scope] : undefined;
  },

  getActiveExpanded: (scope) => {
    const id = get().getActiveWorkspaceId();
    return id ? get().expandedItems[id]?.[scope] : undefined;
  },

  // Getters for filtered items
  getFilteredItemsIds: (scope) => {
    const filters = get().getActiveFilters(scope);
    return filters ? Object.values(filters).flat() : [];
  },

  getFilteredItemsIdsByCategory: (scope, category) => {
    return get().getActiveFilters(scope)?.[category] || [];
  },
  getFilteredItems: (scope) => {
    const filters = get().getActiveFilters(scope);
    if (!filters) return [];
    const catalog = get().getCatalog(scope);
    return Object.entries(catalog).flatMap(([cat, items]) => {
      const selected = filters[cat as BoardName] || [];
      return items.filter((i) => selected.includes(i.id));
    });
  },
  getFilteredItemsByCategory: (scope, category) => {
    const selected = get().getFilteredItemsIdsByCategory(scope, category);
    const items = get().getCatalog(scope)[category] || [];
    return items.filter((i) => selected.includes(i.id));
  },

  // Stats getters
  getFilteredCount: (scope) => get().getFilteredItemsIds(scope).length,

  getFilteredCountByCategory: (scope, category) =>
    get().getFilteredItemsIdsByCategory(scope, category).length,

  getTotalCount: (scope) => {
    const catalog = get().getCatalog(scope);
    return Object.values(catalog).reduce((acc, items) => acc + items.length, 0);
  },

  getSelectionState: (scope, category) => {
    const selectedCount = get().getFilteredCountByCategory(scope, category);
    const totalItems = get().getCatalog(scope)[category]?.length || 0;

    if (totalItems === 0 || selectedCount === 0) return false;
    if (selectedCount === totalItems) return true;
    return "indeterminate";
  },

  // getCategoryCheckedCount: (scope, category) => {
  //   const activeWorkspaceId = get().getActiveWorkspaceId();
  //   if (!activeWorkspaceId) return 0;

  //   const filter = get().tabFilters[activeWorkspaceId][scope];
  //   if (!filter) return 0;

  //   return filter[category].length;
  // },

  // Filter actions
  selectAllFilters: (scope) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    // Map logs to packets since they share the same catalog
    const catalogKey = scope === "logs" ? "packets" : scope;
    const items = get()[catalogKey] as Record<BoardName, Item[]>;

    const fullFilter = createFullFilter(items);
    get().updateFilters(scope, fullFilter);
  },
  clearFilters: (scope) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;
    const emptyFilter = createEmptyFilter();
    get().updateFilters(scope, emptyFilter);
  },
  toggleCategoryFilter: (scope, category, checked) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    // Map logs to packets since they share the same catalog
    const catalogKey = scope === "logs" ? "packets" : scope;
    const catalogItems = get()[catalogKey] as Record<BoardName, Item[]>;

    const currentFilters =
      get().tabFilters[workspaceId]?.[scope] || createEmptyFilter();

    const newItems = checked
      ? catalogItems[category]?.map((item) => item.id) || []
      : [];

    get().updateFilters(scope, {
      ...currentFilters,
      [category]: newItems,
    });
  },

  toggleItemFilter: (scope, category, itemId) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    const currentWorkspaceFilters = get().tabFilters[workspaceId] || {};
    const currentTabFilter =
      currentWorkspaceFilters[scope] || createEmptyFilter();

    const currentCategoryIds = currentTabFilter[category] || [];

    const isSelected = currentCategoryIds.includes(itemId);
    const newCategoryIds = isSelected
      ? currentCategoryIds.filter((id) => id !== itemId)
      : [...currentCategoryIds, itemId];

    get().updateFilters(scope, {
      ...currentTabFilter,
      [category]: newCategoryIds,
    });
  },

  // Expanded items
  expandedItems: {},
  isItemExpanded: (scope, itemId) => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return false;

    const expandedItems = get().expandedItems[activeWorkspaceId]?.[scope];
    if (!expandedItems) return false;

    return expandedItems.has(itemId);
  },
  toggleExpandedItem: (scope, itemId) => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    set((state) => {
      const expandedItems =
        state.expandedItems[activeWorkspaceId]?.[scope] || new Set();
      const newExpandedItems = new Set(expandedItems);

      if (newExpandedItems.has(itemId)) {
        newExpandedItems.delete(itemId);
      } else {
        newExpandedItems.add(itemId);
      }

      return {
        expandedItems: {
          ...state.expandedItems,
          [activeWorkspaceId]: {
            ...state.expandedItems[activeWorkspaceId],
            [scope]: newExpandedItems,
          },
        },
      };
    });
  },

  // Filter dialog
  filterDialog: {
    isOpen: false,
    scope: null,
  },

  openFilterDialog: (scope: FilterScope) =>
    set({ filterDialog: { isOpen: true, scope } }),
  closeFilterDialog: () =>
    set({ filterDialog: { isOpen: false, scope: null } }),

  // Telemetry Charts
  charts: {
    "workspace-1": [],
    "workspace-2": [],
    "workspace-3": [],
  },

  setCharts: (charts) => set({ charts }),

  getActiveWorkspaceCharts: () => {
    const id = get().getActiveWorkspaceId();
    return id ? get().charts[id] || [] : [];
  },

  // Future-proofing Actions
  addChart: (workspaceId) => {
    const newChartId = crypto.randomUUID();
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: [
          ...(state.charts[workspaceId] || []),
          { id: newChartId, series: [] },
        ],
      },
    }));
    return newChartId;
  },

  removeChart: (workspaceId, chartId) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).filter(
          (c) => c.id !== chartId,
        ),
      },
    })),

  addSeriesToChart: (workspaceId, chartId, series) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).map((c) =>
          c.id === chartId ? { ...c, series: [...c.series, series] } : c,
        ),
      },
    })),

  removeSeriesFromChart: (workspaceId, chartId, variable) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).map((c) =>
          c.id === chartId
            ? { ...c, series: c.series.filter((s) => s.variable !== variable) }
            : c,
        ),
      },
    })),
});
