import { create } from "zustand";
import { getActiveTabId } from "./useTabStore";
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

    getSelected: () => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return [];
      const filter = get().tabFilters[activeTabId];
      return Object.values<string[]>(filter).flat();
    },

    getSelectedByCategory: (category) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return [];
      const filter = get().tabFilters[activeTabId];
      return filter[category];
    },

    toggleItem: (category, id) =>
      set((state) => {
        const activeTabId = getActiveTabId();
        if (!activeTabId) return state;

        const currentFilter = state.tabFilters[activeTabId];
        const currentItems = currentFilter[category];
        const newItems = currentItems.includes(id)
          ? currentItems.filter((itemId) => itemId !== id)
          : [...currentItems, id];

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeTabId]: {
              ...currentFilter,
              [category]: newItems,
            },
          },
        };
      }),

    toggleCategory: (category, checked) =>
      set((state) => {
        const activeTabId = getActiveTabId();
        if (!activeTabId) return state;

        const currentFilter = state.tabFilters[activeTabId];

        const newItems = checked
          ? dataSource[category].map((item) => item.id)
          : [];

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeTabId]: {
              ...currentFilter,
              [category]: newItems,
            },
          },
        };
      }),

    getCategoryCheckedCount: (category) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return 0;
      const filter = get().tabFilters[activeTabId];
      return filter[category].length;
    },

    getCategoryTotalCount: (category) => {
      return dataSource[category].length;
    },

    getCategoryState: (category) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) {
        return { checked: false, indeterminate: false };
      }

      const filter = get().tabFilters[activeTabId];
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
        const activeTabId = getActiveTabId();
        if (!activeTabId) return state;

        const emptyFilter = createEmptyFilter(categories);

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeTabId]: emptyFilter,
          },
        };
      }),

    selectAll: () =>
      set((state) => {
        const activeTabId = getActiveTabId();
        if (!activeTabId) return state;

        const fullFilter = createFullFilter(categories, dataSource);

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeTabId]: fullFilter,
          },
        };
      }),

    isFilterDialogOpen: false,
    openFilterDialog: () => set({ isFilterDialogOpen: true }),
    closeFilterDialog: () => set({ isFilterDialogOpen: false }),
  }));
};
