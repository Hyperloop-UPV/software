import { create } from "zustand";
import { getActiveTabId } from "./useTabStore";
import { generateInitialFilters } from "../lib/utils";
import type { TabFilter } from "../types/TabFilter";
import type { Item } from "../types/Item";

interface FilterableStoreConfig<TCategory extends string, TItem> {
  categories: readonly TCategory[];
  getMockData: () => Record<TCategory, TItem[]>;
}

export const createFilterableStore = <
  TCategory extends string,
  TItem extends Item,
>({
  categories,
  getMockData,
}: FilterableStoreConfig<TCategory, TItem>) => {
  const createDefaultFilter = (): TabFilter<TCategory> => {
    const mockData = getMockData();
    return categories.reduce((acc, category) => {
      acc[category] = mockData[category].map((item) => item.id);
      return acc;
    }, {} as TabFilter<TCategory>);
  };

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
    tabFilters: generateInitialFilters(createDefaultFilter()),

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
        const mockData = getMockData();
        const newItems = checked
          ? mockData[category].map((item) => item.id)
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
      const mockData = getMockData();
      return mockData[category].length;
    },

    getCategoryState: (category) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) {
        return { checked: false, indeterminate: false };
      }

      const filter = get().tabFilters[activeTabId];
      const selectedInCategory = filter[category];
      const mockData = getMockData();
      const totalInCategory = mockData[category].length;
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

        const emptyFilter = categories.reduce((acc, category) => {
          acc[category] = [];
          return acc;
        }, {} as TabFilter<TCategory>);

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

        return {
          tabFilters: {
            ...state.tabFilters,
            [activeTabId]: createDefaultFilter(),
          },
        };
      }),

    isFilterDialogOpen: false,
    openFilterDialog: () => set({ isFilterDialogOpen: true }),
    closeFilterDialog: () => set({ isFilterDialogOpen: false }),
  }));
};
