import { create } from "zustand";
import { DEFAULT_TABS } from "../constants/defaultTabs";

export interface Tab {
  name: string;
  id: string;
  description: string;
}

interface TabStore {
  activeTab: Tab | null;
  tabs: Tab[];
  setActiveTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  addTab: (tab: Tab) => void;
}

export const useTabStore = create<TabStore>((set) => ({
  activeTab: DEFAULT_TABS[0]!,
  tabs: DEFAULT_TABS,

  setActiveTab: (tab) => set({ activeTab: tab }),

  removeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((tab) => tab.id !== id);
      const newActiveTab =
        state.activeTab?.id === id ? newTabs[0] || null : state.activeTab;
      return { tabs: newTabs, activeTab: newActiveTab };
    }),

  addTab: (tab) => set((state) => ({ tabs: [...state.tabs, tab] })),
}));

// Helper function to get active tab ID
export const getActiveTabId = (): string | null => {
  return useTabStore.getState().activeTab?.id ?? null;
};
