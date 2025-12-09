import { create } from "zustand";
import { getActiveTabId } from "./useTabStore";
import { DEFAULT_TABS } from "../constants/defaultTabs";

interface PacketsStore {
  tabPacketFilters: Record<string, string[]>;
  togglePacket: (pktId: string) => void;
  clearAll: () => void;
  selectAll: (allPacketIds: string[]) => void;
  setVisiblePackets: (packetIds: string[]) => void;
  getVisiblePackets: () => string[];
  isFilterDialogOpen: boolean;
  setIsFilterDialogOpen: (open: boolean) => void;
  openFilterDialog: () => void;
  closeFilterDialog: () => void;
}

const getDefaultPacketIds = () => [];

const generateInitialFilters = (): Record<string, string[]> => {
  return DEFAULT_TABS.reduce(
    (acc, tab) => {
      acc[tab.id] = getDefaultPacketIds();
      return acc;
    },
    {} as Record<string, string[]>,
  );
};

export const usePacketsStore = create<PacketsStore>((set, get) => ({
  tabPacketFilters: generateInitialFilters(),

  getVisiblePackets: () => {
    const activeTabId = getActiveTabId();
    if (!activeTabId) return [];

    const filters = get().tabPacketFilters[activeTabId];
    return filters || getDefaultPacketIds();
  },

  togglePacket: (pktId) =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      const currentIds = state.tabPacketFilters[activeTabId];

      const newIds = currentIds.includes(pktId)
        ? currentIds.filter((id) => id !== pktId)
        : [...currentIds, pktId];

      return {
        tabPacketFilters: {
          ...state.tabPacketFilters,
          [activeTabId]: newIds,
        },
      };
    }),

  clearAll: () =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      return {
        tabPacketFilters: {
          ...state.tabPacketFilters,
          [activeTabId]: [],
        },
      };
    }),

  selectAll: (allPacketIds) =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      return {
        tabPacketFilters: {
          ...state.tabPacketFilters,
          [activeTabId]: allPacketIds,
        },
      };
    }),

  setVisiblePackets: (packetIds) =>
    set((state) => {
      const activeTabId = getActiveTabId();
      if (!activeTabId) return state;

      return {
        tabPacketFilters: {
          ...state.tabPacketFilters,
          [activeTabId]: packetIds,
        },
      };
    }),

  isFilterDialogOpen: false,
  setIsFilterDialogOpen: (open) => set({ isFilterDialogOpen: open }),
  openFilterDialog: () => set({ isFilterDialogOpen: true }),
  closeFilterDialog: () => set({ isFilterDialogOpen: false }),
}));
