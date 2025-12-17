import { DEFAULT_WORKSPACES } from "../constants/defaultWorkspaces";
import type { Item } from "../types/Item";
import type { FilterKey, TabFilter } from "../types/TabFilter";

export const generateInitialFilters = <T extends FilterKey>(
  defaultIds: TabFilter<T>,
): Record<string, TabFilter<T>> => {
  return DEFAULT_WORKSPACES.reduce(
    (acc, workspace) => {
      acc[workspace.id] = defaultIds;
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

export const getTypeBadgeClass = (type: string) => {
  switch (type.toLowerCase()) {
    case "float":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20";
    case "integer":
    case "int":
      return "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20";
    case "string":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/20";
    case "boolean":
    case "bool":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20";
    default:
      return "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30 hover:bg-muted-foreground/20";
  }
};
