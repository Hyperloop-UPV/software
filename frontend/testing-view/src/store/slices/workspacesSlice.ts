import type { StateCreator } from "zustand";
import { DEFAULT_WORKSPACES } from "../../constants/defaultWorkspaces";
import {
  createEmptyFilter,
  createFullFilter,
  generateInitialFilters,
  getCatalogKey,
} from "../../lib/utils";
import type { Item } from "../../types/common/item";
import type { BoardName } from "../../types/data/board";
import type { Measurement } from "../../types/data/telemetryCatalogItem";
import type { VirtualRow } from "../../types/data/virtualization";
import type {
  FilterScope,
  TabFilter,
  WorkspaceFilters,
} from "../../types/workspace/filters";
import type {
  SidebarTab,
  WorkspaceExpandedItems,
} from "../../types/workspace/sidebar";
import type { Workspace } from "../../types/workspace/workspace";
import type { Store } from "../store";

export interface WorkspaceChartSeries {
  packetId: number;
  variable: string;
}

export interface WorkspaceChartConfig {
  id: string;
  series: WorkspaceChartSeries[];
  historyLimit: number;
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
  isItemExpanded: (
    scope: SidebarTab,
    type: string,
    itemId: number | string,
  ) => boolean;
  toggleExpandedItem: (
    scope: SidebarTab,
    type: string,
    itemId: number | string,
  ) => void;
  getFlattenedRows: (
    scope: SidebarTab,
    categories: readonly BoardName[],
  ) => VirtualRow[];

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
  reorderCharts: (
    workspaceId: string,
    oldIndex: number,
    newIndex: number,
  ) => void;
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
  setChartHistoryLimit: (
    workspaceId: string,
    chartId: string,
    newHistoryLimit: number,
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
    const catalogKey = getCatalogKey(scope);
    if (!catalogKey) return {};

    return get()[catalogKey];
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
    const commands = get().commandsCatalog;
    const telemetry = get().telemetryCatalog;

    const currentFilters = get().tabFilters;

    // Only initialize if filters are empty (not persisted)
    if (Object.keys(currentFilters).length === 0) {
      set({
        tabFilters: generateInitialFilters({
          commands: createFullFilter(commands),
          telemetry: createFullFilter(telemetry),
          logs: createFullFilter(telemetry),
        }),
      });
    }
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
    if (!catalog) return [];

    return Object.entries(catalog).flatMap(([cat, items]) => {
      const selected = filters[cat as BoardName] || [];
      return items.filter((i) => selected.includes(i.id));
    });
  },
  getFilteredItemsByCategory: (scope, category) => {
    const selected = get().getFilteredItemsIdsByCategory(scope, category);
    const catalog = get().getCatalog(scope);
    const items = catalog?.[category] || [];
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
    const catalog = get().getCatalog(scope);
    const totalItems = catalog?.[category]?.length || 0;

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

    const items = get().getCatalog(scope);

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

    const catalog = get().getCatalog(scope);

    const currentFilters =
      get().tabFilters[workspaceId]?.[scope] || createEmptyFilter();

    const newItems = checked
      ? catalog?.[category]?.map((item) => item.id) || []
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
  isItemExpanded: (scope, type, itemId) => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return false;

    const expandedItems = get().expandedItems[activeWorkspaceId]?.[scope];
    if (!expandedItems) return false;

    return expandedItems.has(`${type}:${itemId}`);
  },
  toggleExpandedItem: (scope, type, itemId) => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    set((state) => {
      const expandedItems =
        state.expandedItems[activeWorkspaceId]?.[scope] || new Set();
      const newExpandedItems = new Set(expandedItems);

      if (newExpandedItems.has(`${type}:${itemId}`)) {
        newExpandedItems.delete(`${type}:${itemId}`);
      } else {
        newExpandedItems.add(`${type}:${itemId}`);
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
  getFlattenedRows: (scope, categories) => {
    const rows: VirtualRow[] = [];

    categories.forEach((category) => {
      const items = get().getFilteredItemsByCategory(scope, category);
      if (items.length === 0) return;

      // Add the Header (Board)
      rows.push({
        type: "board",
        id: category,
        label: category,
        count: items.length,
      });

      // If the board is expanded, add its packets
      if (get().isItemExpanded(scope, "board", category)) {
        items.forEach((item) => {
          rows.push({
            type: "packet",
            id: item.id,
            data: item,
          });

          // If the packet is expanded, add its variables/measurements
          if (get().isItemExpanded(scope, "packet", item.id)) {
            if ("measurements" in item) {
              const variables = item.measurements as Measurement[];
              variables.forEach((m) => {
                rows.push({
                  type: "variable",
                  id: `${item.id}-${m.id}`,
                  data: m,
                  packetId: item.id,
                });
              });
            }
          }
        });
      }
    });

    return rows;
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
          { id: newChartId, series: [], historyLimit: 200 },
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

  clearCharts: () => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    set((state) => ({
      charts: {
        ...state.charts,
        [activeWorkspaceId]: [],
      },
    }));
  },

  reorderCharts: (workspaceId, oldIndex, newIndex) => {
    if (oldIndex < 0 || newIndex < 0) return;

    set((state) => {
      const charts = [...(state.charts[workspaceId] || [])];
      const [removed] = charts.splice(oldIndex, 1);
      charts.splice(newIndex, 0, removed);
      return {
        charts: {
          ...state.charts,
          [workspaceId]: charts,
        },
      };
    });
  },

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

  setChartHistoryLimit: (workspaceId, chartId, newHistoryLimit) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).map((c) =>
          c.id === chartId ? { ...c, historyLimit: newHistoryLimit } : c,
        ),
      },
    })),
});
