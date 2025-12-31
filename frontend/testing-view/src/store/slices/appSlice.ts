import type { StateCreator } from "zustand";
import type { Store } from "../store";
import type { AppMode } from "../../types/app/mode";
import type { ColorScheme } from "../../types/app/colorSchema";

export interface AppSlice {
  // App mode
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Error state
  error: Error | null;
  setError: (error: Error | null) => void;

  // Mode override (only used in dev mode)
  modeOverride: AppMode | null;
  setModeOverride: (mode: AppMode | null) => void;

  // Color scheme
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;

  // Dark mode
  isDarkMode: boolean;
  setIsDarkMode: (isDarkMode: boolean) => void;
  toggleDarkMode: () => void;

  // Testing page
  testingPage: {
    columns: number;
    isSidebarVisible: boolean;
  };
  setTestingColumns: (columns: number) => void;
  setTestingSidebarVisible: (isSidebarVisible: boolean) => void;
}

export const createAppSlice: StateCreator<Store, [], [], AppSlice> = (set) => ({
  // App mode
  appMode: "loading",
  setAppMode: (mode) => set({ appMode: mode }),

  // Error state
  error: null,
  setError: (error) => set({ error }),

  // Mode override (only used in dev mode)
  modeOverride: null,
  setModeOverride: (mode) => set({ modeOverride: mode }),

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

  // Testing page
  testingPage: {
    columns: 1,
    isSidebarVisible: true,
  },
  setTestingColumns: (columns) =>
    set((state) => ({ testingPage: { ...state.testingPage, columns } })),
  setTestingSidebarVisible: (isSidebarVisible) =>
    set((state) => ({
      testingPage: { ...state.testingPage, isSidebarVisible },
    })),
});
