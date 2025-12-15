import { create } from "zustand";
import type { Workspace } from "../types/Workspace";
import { DEFAULT_WORKSPACES } from "../constants/defaultWorkspaces";

interface WorkspacesStore {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  setActiveWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (id: string) => void;
  addWorkspace: (workspace: Workspace) => void;
}

export const useWorkspacesStore = create<WorkspacesStore>((set) => ({
  activeWorkspace: DEFAULT_WORKSPACES[0]!,
  workspaces: DEFAULT_WORKSPACES,

  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),

  removeWorkspace: (id) =>
    set((state) => {
      const newWorkspaces = state.workspaces.filter(
        (workspace) => workspace.id !== id,
      );
      const newActiveWorkspace =
        state.activeWorkspace?.id === id
          ? newWorkspaces[0] || null
          : state.activeWorkspace;
      return { workspaces: newWorkspaces, activeWorkspace: newActiveWorkspace };
    }),

  addWorkspace: (workspace) =>
    set((state) => ({ workspaces: [...state.workspaces, workspace] })),
}));

// Helper function to get active workspace ID
export const getActiveWorkspaceId = (): string | null => {
  const activeWorkspace = useWorkspacesStore.getState().activeWorkspace;
  return activeWorkspace?.id ?? null;
};
