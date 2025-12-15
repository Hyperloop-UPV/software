import { create } from "zustand";
import { getActiveWorkspaceId } from "./useWorkspacesStore";
import type { SidebarTab } from "../types/SidebarTab";

interface TabsStore {
  activeTab: Record<string, SidebarTab>;
  getActiveTab: () => SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
}

export const useTabsStore = create<TabsStore>((set, get) => ({
  activeTab: {},
  getActiveTab: () => {
    const activeWorkspaceId = getActiveWorkspaceId();
    if (!activeWorkspaceId) return "commands";
    return get().activeTab[activeWorkspaceId] || "commands";
  },

  setActiveTab: (tab) => {
    const activeWorkspaceId = getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    set((state) => ({
      activeTab: { ...state.activeTab, [activeWorkspaceId]: tab },
    }));
  },
}));
