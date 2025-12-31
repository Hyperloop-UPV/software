import { acronyms } from "../constants/acronyms";
import { BOARD_NAMES } from "../constants/boards";
import { DEFAULT_WORKSPACES } from "../constants/defaultWorkspaces";
import type { Item } from "../types/common/item";
import type { BoardName } from "../types/data/board";
import type {
  FilterScope,
  TabFilter,
  WorkspaceFilters,
} from "../types/workspace/filters";

type InitialFilters = Record<FilterScope, TabFilter>;

export const generateInitialFilters = (
  filters: InitialFilters,
): Record<string, WorkspaceFilters> => {
  return DEFAULT_WORKSPACES.reduce(
    (acc, workspace) => {
      acc[workspace.id] = {
        commands: filters.commands,
        packets: filters.packets,
        logs: filters.logs,
      };
      return acc;
    },
    {} as Record<string, WorkspaceFilters>,
  );
};

export const createEmptyFilter = (): TabFilter => {
  return BOARD_NAMES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as TabFilter);
};

export const createFullFilter = (
  dataSource: Record<BoardName, Item[]>,
): TabFilter => {
  return BOARD_NAMES.reduce((acc, category) => {
    acc[category] = dataSource[category].map((item) => item.id);
    return acc;
  }, {} as TabFilter);
};

export const getTypeBadgeClass = (type: string) => {
  switch (type.toLowerCase()) {
    case "float":
    case "float32":
    case "float64":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "integer":
    case "int":
    case "int8":
    case "int16":
    case "int32":
    case "int64":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "string":
    case "enum":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "boolean":
    case "bool":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30";
  }
};

export const formatName = (name: string): string => {
  const withoutParentheses = name.replace(/[()]/g, "");

  // Remove common board prefixes
  const withoutPrefix = withoutParentheses
    .replace(/(bcu|pcu|lcu|hvscu|bmsl|vcu)_/, "")
    .replace(/hvscu_cabinet_/, "");

  // Split by underscore and capitalize each word
  const words = withoutPrefix.split(/[_ ]+/);

  const formatted = words
    .map((word) => {
      const upperWord = word.toUpperCase();
      // Check if word is an acronym
      if (acronyms.includes(upperWord)) {
        return upperWord;
      }
      // Capitalize first letter, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  return formatted;
};
