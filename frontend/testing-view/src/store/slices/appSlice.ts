import type { StateCreator } from "zustand";
import type { Store } from "../store";

export type AppMode = "loading" | "active" | "mock" | "error";
export type ColorScheme = "default" | "pink";

export interface AppSlice {
  // App mode
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Color scheme
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;

  // Dark mode
  isDarkMode: boolean;
  setIsDarkMode: (isDarkMode: boolean) => void;
  toggleDarkMode: () => void;
}

export const createAppSlice: StateCreator<Store, [], [], AppSlice> = (set) => ({
  // App mode
  appMode: "loading",
  setAppMode: (mode) => set({ appMode: mode }),

  // Color scheme
  colorScheme: "default",
  setColorScheme: (scheme) => set({ colorScheme: scheme }),
  toggleColorScheme: () =>
    set((state) => ({
      colorScheme: state.colorScheme === "default" ? "pink" : "default",
    })),

  // Dark mode
  isDarkMode: false,
  setIsDarkMode: (isDarkMode) => set({ isDarkMode }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
});
