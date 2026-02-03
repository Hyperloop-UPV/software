import type { StateCreator } from "zustand";
import type { Store } from "../../../store/store";

export interface RightSidebarSlice {
  // Section visibility
  isTabsVisible: boolean;
  isMessagesVisible: boolean;
  toggleTabs: () => void;
  toggleMessages: () => void;

  // Layout settings
  isHorizontal: boolean;
  isSplit: boolean;
  toggleLayout: () => void;
  toggleSplit: () => void;

  // Computed values
  getBothVisible: () => boolean;
  getNoneVisible: () => boolean;
}

export const createRightSidebarSlice: StateCreator<
  Store,
  [],
  [],
  RightSidebarSlice
> = (set, get) => ({
  // Section visibility
  isTabsVisible: true,
  isMessagesVisible: true,
  toggleTabs: () => set({ isTabsVisible: !get().isTabsVisible }),
  toggleMessages: () => set({ isMessagesVisible: !get().isMessagesVisible }),

  // Layout settings
  isHorizontal: true,
  isSplit: false,
  toggleLayout: () => set({ isHorizontal: !get().isHorizontal }),
  toggleSplit: () => set({ isSplit: !get().isSplit }),

  // Computed values
  getBothVisible: () => get().isTabsVisible && get().isMessagesVisible,
  getNoneVisible: () => !get().isTabsVisible && !get().isMessagesVisible,
});
