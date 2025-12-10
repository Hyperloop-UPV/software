import { DEFAULT_TABS } from "../constants/defaultTabs";
import { BOARD_NAMES } from "../mocks/commands";
import type { TabFilter } from "../store/useCommandsStore";
import type { Tab } from "../store/useTabStore";

export const generateInitialFilters = (
  defaultIds: TabFilter,
): Record<string, TabFilter> => {
  return DEFAULT_TABS.reduce(
    (acc, tab) => {
      acc[tab.id] = defaultIds;
      return acc;
    },
    {} as Record<string, TabFilter>,
  );
};

export const emptyFilter = BOARD_NAMES.reduce((acc, boardName) => {
  acc[boardName] = [];
  return acc;
}, {} as TabFilter);

export const fullFilter = (MOCK_DATA: TabFilter) =>
  BOARD_NAMES.reduce((acc, boardName) => {
    acc[boardName] = MOCK_DATA[boardName];
    return acc;
  }, {} as TabFilter);
