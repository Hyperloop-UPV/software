import { create } from "zustand";

export interface ColumnsStore {
    columnSizes: string[];
    setColumnSizes: (setColumnSizes: string[]) => void;
};

// Zustand store for keeping track of column sizes.
// It is useful to the layout of the application.
export const useColumnsStore = create<ColumnsStore>((set) => ({
    columnSizes: ["30%", "10%", "20%", "20%", "20%"] as string[],
    setColumnSizes: (columnSizes: string[]) => set({ columnSizes }),
}));