import { acronyms } from "../constants/acronyms";
import { BOARD_NAMES } from "../constants/boards";
import { variablesBadgeClasses } from "../constants/variablesBadgeClasses";
import type {
  FilterScope,
  TabFilter,
  WorkspaceFilters,
} from "../features/filtering/types/filters";
import { DEFAULT_WORKSPACES } from "../features/workspace/constants/defaultWorkspaces";
import type { CatalogItem } from "../types/common/item";
import type { BoardName } from "../types/data/board";
import type { MessageTimestamp } from "../types/data/message";

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
  dataSource: Record<BoardName, CatalogItem[]>,
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
      return variablesBadgeClasses.float;

    case "integer":
    case "int":
    case "int8":
    case "int16":
    case "int32":
    case "int64":
      return variablesBadgeClasses.integer;

    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
      return variablesBadgeClasses.uint8;

    case "string":
    case "enum":
      return variablesBadgeClasses.enum;

    case "boolean":
    case "bool":
      return variablesBadgeClasses.boolean;

    default:
      return variablesBadgeClasses.unknown;
  }
};

export const formatName = (name: string): string => {
  const withoutParentheses = name.replace(/[()]/g, "");

  // Remove common board prefixes
  const withoutPrefix = withoutParentheses.replace(
    /(bcu|pcu|lcu|hvscu_cabinet|hvscu|bmsl|vcu)_/,
    "",
  );

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
  if (!ts) return "00:00:00";
  return `${ts.hour.toString().padStart(2, "0")}:${ts.minute.toString().padStart(2, "0")}:${ts.second.toString().padStart(2, "0")}`;
};
