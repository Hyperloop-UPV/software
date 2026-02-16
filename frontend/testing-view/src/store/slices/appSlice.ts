import type { StateCreator } from "zustand";
import type { ColorScheme } from "../../types/app/colorSchema";
import type { AppMode } from "../../types/app/mode";
import type { ConfigData } from "../../types/common/config";
import type { Store } from "../store";

export interface AppSlice {
  // App mode
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Error state
  error: Error | null;
  setError: (error: Error | null) => void;

  isRestarting: boolean;
  setRestarting: (isRestarting: boolean) => void;

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

  // Config and settings
  isSettingsOpen: boolean;
  setSettingsOpen: (isOpen: boolean) => void;
  config: ConfigData | null;
  setConfig: (config: ConfigData | null) => void;
  isLoadingConfig: boolean;
  setIsLoadingConfig: (loading: boolean) => void;
}

export const createAppSlice: StateCreator<Store, [], [], AppSlice> = (set) => ({
  // App mode
  appMode: "loading",
  setAppMode: (mode) => set({ appMode: mode }),

  // Error state
  error: null,
  setError: (error) => set({ error }),

  // Happens when we restart the backend on config change
  isRestarting: false,
  setRestarting: (isRestarting) => set({ isRestarting }),

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

  // Config and settings
  isSettingsOpen: false,
  setSettingsOpen: (isOpen: boolean) => set({ isSettingsOpen: isOpen }),
  config: null,
  setConfig: (config: ConfigData | null) => set({ config }),
  isLoadingConfig: false,
  setIsLoadingConfig: (loading: boolean) => set({ isLoadingConfig: loading }),
});
