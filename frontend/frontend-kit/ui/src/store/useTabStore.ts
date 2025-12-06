import { create } from "zustand";

export interface Tab {
  name: string;
  id: string;
  description: string;
}

interface TabStore {
  activeTab: Tab | null;
  setActiveTab: (tab: Tab) => void;
  tabs: Tab[];
  removeTab: (id: string) => void;
  addTab: (tab: Tab) => void;
}

const defaultTabs: Tab[] = [
  { name: "Tab 1", id: "tab-1", description: "Tab 1 description" },
  { name: "Tab 2", id: "tab-2", description: "Tab 2 description" },
  { name: "Tab 3", id: "tab-3", description: "Tab 3 description" },
];

export const useTabStore = create<TabStore>((set) => ({
  activeTab: defaultTabs[0]!,
  tabs: defaultTabs,
  setActiveTab: (tab) => set({ activeTab: tab }),
  removeTab: (id) =>
    set((state) => ({ tabs: state.tabs.filter((tab) => tab.id !== id) })),
  addTab: (tab) => set((state) => ({ tabs: [...state.tabs, tab] })),
}));
