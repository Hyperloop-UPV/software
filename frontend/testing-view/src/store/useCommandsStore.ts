import { create } from "zustand";
import { getAllCommands } from "../mocks/commands";
import { getActiveTabId } from "./useTabStore";

interface CommandsStore {
  tabCommandFilters: Record<string, string[]>;
  toggleCommand: (cmdId: string) => void;
  clearAll: () => void;
  selectAll: () => void;
  setVisibleCommands: (commandIds: string[]) => void;
  getVisibleCommands: () => string[];
  isFilterDialogOpen: boolean;
  setIsFilterDialogOpen: (open: boolean) => void;
  openFilterDialog: () => void;
  closeFilterDialog: () => void;
}

const getDefaultCommandIds = () => getAllCommands().map((cmd) => cmd.id);

export const useCommandsStore = create<CommandsStore>((set, get) => ({
  tabCommandFilters: {
    "tab-1": getDefaultCommandIds(),
    "tab-2": getDefaultCommandIds(),
    "tab-3": getDefaultCommandIds(),
  },

  getVisibleCommands: () => {
    const activeTabId = getActiveTabId();
    if (!activeTabId) return [];

    const filters = get().tabCommandFilters[activeTabId];
    return filters || getDefaultCommandIds();
  },

  toggleCommand: (cmdId) =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      const currentIds =
        state.tabCommandFilters[activeTabId] || getDefaultCommandIds();
      const newIds = currentIds.includes(cmdId)
        ? currentIds.filter((id) => id !== cmdId)
        : [...currentIds, cmdId];

      return {
        tabCommandFilters: {
          ...state.tabCommandFilters,
          [activeTabId]: newIds,
        },
      };
    }),

  clearAll: () =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      return {
        tabCommandFilters: {
          ...state.tabCommandFilters,
          [activeTabId]: [],
        },
      };
    }),

  selectAll: () =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      return {
        tabCommandFilters: {
          ...state.tabCommandFilters,
          [activeTabId]: getDefaultCommandIds(),
        },
      };
    }),

  setVisibleCommands: (commandIds) =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      return {
        tabCommandFilters: {
          ...state.tabCommandFilters,
          [activeTabId]: commandIds,
        },
      };
    }),

  isFilterDialogOpen: false,
  setIsFilterDialogOpen: (open) => set({ isFilterDialogOpen: open }),
  openFilterDialog: () => set({ isFilterDialogOpen: true }),
  closeFilterDialog: () => set({ isFilterDialogOpen: false }),
}));
