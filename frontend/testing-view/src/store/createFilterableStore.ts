import { create } from "zustand";
import { getActiveWorkspaceId } from "./useWorkspacesStore";
import {
  createEmptyFilter,
  createFullFilter,
  generateInitialFilters,
} from "../lib/utils";
import type { TabFilter } from "../types/TabFilter";
import type { Item } from "../types/Item";

interface FilterableStoreConfig<TCategory extends string, TItem> {
  categories: readonly TCategory[];
  dataSource: Record<TCategory, TItem[]>;
  defaultFilter: TabFilter<TCategory>;
}

export const createFilterableStore = <
  TCategory extends string,
  TItem extends Item,
>({
  categories,
  dataSource,
  defaultFilter,
}: FilterableStoreConfig<TCategory, TItem>) => {
  return create<{
    tabFilters: Record<string, TabFilter<TCategory>>;
    expandedItems: Record<string, Set<string>>;

    isItemExpanded: (itemId: string) => boolean;
    toggleExpandedItem: (itemId: string) => void;

    getSelected: () => string[];
    getSelectedByCategory: (category: TCategory) => string[];
    toggleItem: (category: TCategory, id: string) => void;
    toggleCategory: (category: TCategory, checked: boolean) => void;
    getCategoryState: (category: TCategory) => {
      checked: boolean;
      indeterminate: boolean;
    };
    getCategoryCheckedCount: (category: TCategory) => number;
    getCategoryTotalCount: (category: TCategory) => number;
    clearAll: () => void;
    selectAll: () => void;

    isFilterDialogOpen: boolean;
    openFilterDialog: () => void;
    closeFilterDialog: () => void;
  }>((set, get) => ({
    tabFilters: generateInitialFilters(defaultFilter),
    expandedItems: {},

    isItemExpanded: (itemId: string) => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) return false;
      const expandedItems = get().expandedItems[activeWorkspaceId];
      return expandedItems?.has(itemId) ?? false;
    },

    toggleExpandedItem: (itemId: string) => {
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
      return Object.values<string[]>(filter).flat();
    },

    getSelectedByCategory: (category) => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) return [];
      const filter = get().tabFilters[activeWorkspaceId];
      return filter[category];
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
          ? dataSource[category].map((item) => item.id)
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
      return dataSource[category].length;
    },

    getCategoryState: (category) => {
      const activeWorkspaceId = getActiveWorkspaceId();
      if (!activeWorkspaceId) {
        return { checked: false, indeterminate: false };
      }

      const filter = get().tabFilters[activeWorkspaceId];
      const selectedInCategory = filter[category];
      const totalInCategory = dataSource[category].length;
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

        const emptyFilter = createEmptyFilter(categories);

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

        const fullFilter = createFullFilter(categories, dataSource);

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
