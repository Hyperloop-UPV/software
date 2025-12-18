import { create } from "zustand";
import { getActiveWorkspaceId } from "./useWorkspacesStore";
import {
  createEmptyFilter,
  createFullFilter,
  generateInitialFilters,
} from "../lib/utils";
import type { TabFilter } from "../types/TabFilter";
import type { Item } from "../types/Item";
import type { BoardName } from "../types/BoardName";

interface FilterableStoreConfig<TItem extends Item> {
  defaultDataSource: Record<BoardName, TItem[]>;
  defaultFilter: (dataSource: Record<BoardName, TItem[]>) => TabFilter;
}

interface FilterableStoreProps<TItem extends Item> {
  dataSource: Record<BoardName, TItem[]>;
  setDataSource: (dataSource: Record<BoardName, TItem[]>) => void;

  tabFilters: Record<string, TabFilter>;
  expandedItems: Record<string, Set<number | string>>;

  isItemExpanded: (itemId: number | string) => boolean;
  toggleExpandedItem: (itemId: number | string) => void;

  getTotalCount: () => number;

  getSelected: () => number[];

  // Category-based methods
  getSelectedByCategory: (category: BoardName) => number[];
  getTotalCountByCategory: (category: BoardName) => number;
  getItemsByCategory: (category: BoardName) => TItem[];
  toggleItem: (category: BoardName, id: number) => void;
  toggleCategory: (category: BoardName, checked: boolean) => void;
  getCategoryState: (category: BoardName) => {
    checked: boolean;
    indeterminate: boolean;
  };
  getCategoryCheckedCount: (category: BoardName) => number;
  getCategoryTotalCount: (category: BoardName) => number;
  clearAll: () => void;
  selectAll: () => void;

  isFilterDialogOpen: boolean;
  openFilterDialog: () => void;
  closeFilterDialog: () => void;
}

export const createFilterableStore = <TItem extends Item>({
  defaultDataSource,
  defaultFilter,
}: FilterableStoreConfig<TItem>) => {
  return create<FilterableStoreProps<TItem>>((set, get) => ({
    dataSource: defaultDataSource,
    setDataSource: (newDataSource) => {
      const newDefaultFilter = defaultFilter(newDataSource);
      set({
        dataSource: newDataSource,
        tabFilters: generateInitialFilters(newDefaultFilter),
      });
    },

    tabFilters: generateInitialFilters(defaultFilter(defaultDataSource)),
    expandedItems: {},

    isItemExpanded: (itemId: number | string) => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) return false;
      const expandedItems = get().expandedItems[activeWorkspaceId];
      return expandedItems?.has(itemId) ?? false;
    },

    toggleExpandedItem: (itemId: number | string) => {
      set((state) => {
        const activeWorkspaceId = getActiveWorkspaceId();
        if (!activeWorkspaceId) return state;

        const expandedItems =
          state.expandedItems[activeWorkspaceId] || new Set();
        const newExpandedItems = new Set(expandedItems);

        if (newExpandedItems.has(itemId)) {
          newExpandedItems.delete(itemId);
        } else {
          newExpandedItems.add(itemId);
        }

        return {
          expandedItems: {
            ...state.expandedItems,
            [activeWorkspaceId]: newExpandedItems,
          },
        };
      });
    },

    getSelected: () => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) return [];
      const filter = get().tabFilters[activeWorkspaceId];
      return Object.values<number[]>(filter).flat();
    },

    getTotalCount: () => {
      return Object.values(get().dataSource).flat().length;
    },

    getSelectedByCategory: (category) => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) return [];
      const filter = get().tabFilters[activeWorkspaceId];
      return filter[category];
    },

    getItemsByCategory: (category: BoardName) => {
      return get().dataSource[category];
    },

    getTotalCountByCategory: (category: BoardName) => {
      return get().dataSource[category].length;
    },

    toggleItem: (category, id) =>
      set((state) => {
        const activeWorkspaceId = getActiveWorkspaceId();
        if (!activeWorkspaceId) return state;

        const currentFilter = state.tabFilters[activeWorkspaceId];
        const currentItems = currentFilter[category];
        const newItems = currentItems.includes(id)
          ? currentItems.filter((itemId) => itemId !== id)
          : [...currentItems, id];

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeWorkspaceId]: {
              ...currentFilter,
              [category]: newItems,
            },
          },
        };
      }),

    toggleCategory: (category, checked) =>
      set((state) => {
        const activeWorkspaceId = getActiveWorkspaceId();
        if (!activeWorkspaceId) return state;

        const currentFilter = state.tabFilters[activeWorkspaceId];

        const newItems = checked
          ? get().dataSource[category].map((item) => item.id)
          : [];

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeWorkspaceId]: {
              ...currentFilter,
              [category]: newItems,
            },
          },
        };
      }),

    getCategoryCheckedCount: (category) => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) return 0;
      const filter = get().tabFilters[activeWorkspaceId];
      return filter[category].length;
    },

    getCategoryTotalCount: (category) => {
      return get().dataSource[category].length;
    },

    getCategoryState: (category) => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) {
        return { checked: false, indeterminate: false };
      }

      const filter = get().tabFilters[activeWorkspaceId];
      const selectedInCategory = filter[category];
      const totalInCategory = get().dataSource[category].length;
      const checkedCount = selectedInCategory.length;

      if (checkedCount === 0) {
        return { checked: false, indeterminate: false };
      } else if (checkedCount === totalInCategory) {
        return { checked: true, indeterminate: false };
      } else {
        return { checked: false, indeterminate: true };
      }
    },

    clearAll: () =>
      set((state) => {
        const activeWorkspaceId = getActiveWorkspaceId();
        if (!activeWorkspaceId) return state;

        const emptyFilter = createEmptyFilter();

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeWorkspaceId]: emptyFilter,
          },
        };
      }),

    selectAll: () =>
      set((state) => {
        const activeWorkspaceId = getActiveWorkspaceId();
        if (!activeWorkspaceId) return state;

        const fullFilter = createFullFilter(get().dataSource);

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeWorkspaceId]: fullFilter,
          },
        };
      }),

    isFilterDialogOpen: false,
    openFilterDialog: () => set({ isFilterDialogOpen: true }),
    closeFilterDialog: () => set({ isFilterDialogOpen: false }),
  }));
};
