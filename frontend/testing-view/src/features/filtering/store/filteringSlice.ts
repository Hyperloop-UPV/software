import type { StateCreator } from "zustand";
import {
  createEmptyFilter,
  createFullFilter,
  generateInitialFilters,
  getCatalogKey,
} from "../../../lib/utils";
import type { Store } from "../../../store/store";
import type { CatalogItem } from "../../../types/common/item";
import type { BoardName } from "../../../types/data/board";
import type { Variable } from "../../../types/data/telemetryCatalogItem";
import type { VirtualRow } from "../../../types/data/virtualization";
import type { CheckboxState } from "../../charts/types/charts";
import type {
  SidebarTab,
  WorkspaceExpandedItems,
} from "../../workspace/types/sidebar";
import type {
  FilterScope,
  TabFilter,
  WorkspaceFilters,
} from "../types/filters";

export interface FilteringSlice {
  filterDialog: {
    isOpen: boolean;
    scope: FilterScope | null;
  };
  openFilterDialog: (scope: FilterScope) => void;
  closeFilterDialog: () => void;

  /** Filter State */
  workspaceFilters: Record<string, WorkspaceFilters>;
  initializeWorkspaceFilters: () => void;
  updateFilters: (scope: FilterScope, filters: TabFilter) => void;
  getActiveFilters: (scope: FilterScope | null) => TabFilter | undefined;

  /** Filter Actions */
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

  /** Filter Queries */
  getCatalog: (scope: FilterScope) => Record<BoardName, CatalogItem[]>;
  getFilteredItems: (scope: FilterScope) => CatalogItem[];
  getFilteredItemsIds: (scope: FilterScope) => number[];
  getFilteredItemsIdsByCategory: (
    scope: FilterScope,
    category: BoardName,
  ) => number[];
  getFilteredItemsByCategory: (
    scope: FilterScope,
    category: BoardName,
  ) => CatalogItem[];

  getFilteredCount: (scope: FilterScope) => number;
  getFilteredCountByCategory: (
    scope: FilterScope,
    category: BoardName,
  ) => number;
  getTotalCount: (scope: FilterScope) => number;
  isAllSelected: (scope: FilterScope) => boolean;
  getSelectionState: (scope: FilterScope, category: BoardName) => CheckboxState;

  /** Virtualization & Expansion */
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
  getActiveExpanded: (scope: FilterScope) => Set<number | string> | undefined;
  getFlattenedRows: (
    scope: SidebarTab,
    categories: readonly BoardName[],
  ) => VirtualRow[];
}

export const createFilteringSlice: StateCreator<
  Store,
  [],
  [],
  FilteringSlice
> = (set, get) => ({
  openFilterDialog: (scope: FilterScope) =>
    set({ filterDialog: { isOpen: true, scope } }),
  closeFilterDialog: () =>
    set({ filterDialog: { isOpen: false, scope: null } }),

  // Internal helpers
  getCatalog: (scope: FilterScope) => {
    const catalogKey = getCatalogKey(scope);
    if (!catalogKey) return {};

    return get()[catalogKey];
  },

  toggleItemFilter: (scope, category, itemId) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    const currentWorkspaceFilters = get().workspaceFilters[workspaceId] || {};
    const currentTabFilter =
      currentWorkspaceFilters[scope] || createEmptyFilter(get().boards);

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

  // Filter actions
  selectAllFilters: (scope) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    const items = get().getCatalog(scope);

    const fullFilter = createFullFilter(items, get().boards);
    get().updateFilters(scope, fullFilter);
  },
  clearFilters: (scope) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;
    const emptyFilter = createEmptyFilter(get().boards);
    get().updateFilters(scope, emptyFilter);
  },
  toggleCategoryFilter: (scope, category, checked) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    const catalog = get().getCatalog(scope);

    const currentFilters =
      get().workspaceFilters[workspaceId]?.[scope] ||
      createEmptyFilter(get().boards);

    const newItems = checked
      ? catalog?.[category]?.map((item) => item.id) || []
      : [];

    get().updateFilters(scope, {
      ...currentFilters,
      [category]: newItems,
    });
  },

  workspaceFilters: {},
  initializeWorkspaceFilters: () => {
    const commands = get().commandsCatalog;
    const telemetry = get().telemetryCatalog;

    const currentFilters = get().workspaceFilters;

    // Only initialize if filters are empty (not persisted)
    if (Object.keys(currentFilters).length === 0) {
      set({
        workspaceFilters: generateInitialFilters({
          commands: createFullFilter(commands, get().boards),
          telemetry: createFullFilter(telemetry, get().boards),
          logs: createFullFilter(telemetry, get().boards),
        }),
      });
    }
  },
  updateFilters: (scope, filters) => {
    const workspaceId = get().getActiveWorkspaceId();
    if (!workspaceId) return;

    set((state) => ({
      workspaceFilters: {
        ...state.workspaceFilters,
        [workspaceId]: {
          ...(state.workspaceFilters[workspaceId] || {}),
          [scope]: filters,
        },
      },
    }));
  },

  getFilteredItemsByCategory: (scope, category) => {
    const selected = get().getFilteredItemsIdsByCategory(scope, category);
    const catalog = get().getCatalog(scope);
    const items = catalog?.[category] || [];
    return items.filter((i) => selected.includes(i.id));
  },

  // Helper getters
  getActiveFilters: (scope) => {
    const id = get().getActiveWorkspaceId();
    if (!scope) return {};
    return id ? get().workspaceFilters[id]?.[scope] : undefined;
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
              const variables = item.measurements as Variable[];
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

  // Stats getters
  getFilteredCount: (scope) => get().getFilteredItemsIds(scope).length,

  getFilteredCountByCategory: (scope, category) =>
    get().getFilteredItemsIdsByCategory(scope, category).length,

  getTotalCount: (scope) => {
    const catalog = get().getCatalog(scope);
    return Object.values(catalog).reduce((acc, items) => acc + items.length, 0);
  },
  isAllSelected: (scope) => {
    const total = get().getTotalCount(scope);
    return total > 0 && get().getFilteredCount(scope) === total;
  },

  getSelectionState: (scope, category) => {
    const selectedCount = get().getFilteredCountByCategory(scope, category);
    const catalog = get().getCatalog(scope);
    const totalItems = catalog?.[category]?.length || 0;

    if (totalItems === 0 || selectedCount === 0) return false;
    if (selectedCount === totalItems) return true;
    return "indeterminate";
  },
});
