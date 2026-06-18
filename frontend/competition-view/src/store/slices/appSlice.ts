import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface AppSlice {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setIsDarkMode: (isDarkMode: boolean) => void;
}

export const createAppSlice: StateCreator<Store, [], [], AppSlice> = (set) => ({
  isDarkMode: true,
  toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
  setIsDarkMode: (isDarkMode) => set({ isDarkMode }),
});
