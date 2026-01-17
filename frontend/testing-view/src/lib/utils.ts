import { acronyms } from "../constants/acronyms";
import { BOARD_NAMES } from "../constants/boards";
import { DEFAULT_WORKSPACES } from "../constants/defaultWorkspaces";
import type { Item } from "../types/common/item";
import type { BoardName } from "../types/data/board";
import type { MessageTimestamp } from "../types/data/message";
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
        telemetry: filters.telemetry,
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
    acc[category] = dataSource[category]?.map((item) => item.id) || [];
    return acc;
  }, {} as TabFilter);
};

export const getTypeBadgeClass = (type: string) => {
  switch (type.toLowerCase()) {
    case "float":
    case "float32":
    case "float64":
      return "bg-sky-500/20 text-sky-400 border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300";

    case "integer":
    case "int":
    case "int8":
    case "int16":
    case "int32":
    case "int64":
      return "bg-emerald-500/20 text-emerald-500 border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-400";

    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
      return "bg-orange-500/20 text-orange-500 border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-400";

    case "string":
    case "enum":
      return "bg-violet-500/20 text-violet-500 border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-400";

    case "boolean":
    case "bool":
      return "bg-amber-500/20 text-amber-500 border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400";

    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300";
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

// Map logs to telemetry since they share the same catalog
export const getCatalogKey = (scope: FilterScope) => {
  if (scope === "commands") return "commandsCatalog";
  if (scope === "telemetry" || scope === "logs") return "telemetryCatalog";
  return null;
};

// Function for formatting the timestamp in messages
export const formatTimestamp = (ts: MessageTimestamp) => {
  return `${ts.hour.toString().padStart(2, "0")}:${ts.minute.toString().padStart(2, "0")}:${ts.second.toString().padStart(2, "0")}`;
};