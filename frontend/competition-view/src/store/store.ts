import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAppSlice, type AppSlice } from "./slices/appSlice";

export type Store = AppSlice;

export const useStore = create<Store>()(
  persist(
    (...a) => ({
      ...createAppSlice(...a),
    }),
    {
      name: "competition-view-storage",
      version: 1,
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
      }),
    },
  ),
);
