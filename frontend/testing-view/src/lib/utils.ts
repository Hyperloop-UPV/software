import { DEFAULT_TABS } from "../constants/defaultTabs";
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

export const emptyFilter = <T extends FilterKey>(
  categories: readonly T[],
): TabFilter<T> => {
  return categories.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as TabFilter<T>);
};

export const fullFilter = <T extends FilterKey>(
  categories: readonly T[],
  mockData: TabFilter<T>,
): TabFilter<T> => {
  return categories.reduce((acc, category) => {
    acc[category] = mockData[category];
    return acc;
  }, {} as TabFilter<T>);
};
