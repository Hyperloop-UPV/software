// frontend/frontend-kit/ui/src/store/useColorSchemeStore.ts
import { create } from "zustand";

export type ColorScheme = "default" | "pink";

interface ColorSchemeStore {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

export const useColorSchemeStore = create<ColorSchemeStore>()((set) => ({
  colorScheme: "default",
  setColorScheme: (colorScheme) => set({ colorScheme }),
}));
