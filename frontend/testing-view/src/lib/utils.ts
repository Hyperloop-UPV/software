import { DEFAULT_TABS } from "../constants/defaultTabs";
import type { Item } from "../types/Item";
import type { FilterKey, TabFilter } from "../types/TabFilter";

export const generateInitialFilters = <T extends FilterKey>(
  defaultIds: TabFilter<T>,
): Record<string, TabFilter<T>> => {
  return DEFAULT_TABS.reduce(
    (acc, tab) => {
      acc[tab.id] = defaultIds;
      return acc;
    },
    {} as Record<string, TabFilter<T>>,
  );
};

export const createEmptyFilter = <T extends FilterKey>(
  categories: readonly T[],
): TabFilter<T> => {
  return categories.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as TabFilter<T>);
};

export const createFullFilter = <T extends FilterKey>(
  categories: readonly T[],
  dataSource: Record<T, Item[]>,
): TabFilter<T> => {
  return categories.reduce((acc, category) => {
    acc[category] = dataSource[category].map((item) => item.id);
    return acc;
  }, {} as TabFilter<T>);
};
