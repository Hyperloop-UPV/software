import type { StateCreator } from "zustand";
import { createFullFilter } from "../../../lib/utils";
import type { Store } from "../../../store/store";
import type { KeyBinding } from "../../keyBindings/types/keyBinding";
import { DEFAULT_WORKSPACES } from "../constants/defaultWorkspaces";
import type { SidebarTab } from "../types/sidebar";
import type { Workspace } from "../types/workspace";

export interface WorkspacesSlice {
  /** Workspaces */
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  setActiveWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, name: string, description: string) => void;
  removeWorkspace: (id: string) => void;
  addWorkspace: (name: string, description: string) => void;
  getActiveWorkspaceId: () => string | null;

  /** Key Bindings */
  addKeyBinding: (
    commandId: number,
    key: string,
    parameters: Record<string, any>,
  ) => void;
  removeKeyBinding: (bindingId: string) => void;
  getKeyBindings: () => KeyBinding[];
  getCommandIdsByKey: (key: string) => number[];
  getKeyBindingForCommand: (commandId: number) => string | undefined;
  getKeyBindingParameters: (
    commandId: number,
    key: string,
  ) => Record<string, any> | undefined;
}

export const createWorkspacesSlice: StateCreator<
  Store,
  [],
  [],
  WorkspacesSlice
> = (set, get) => ({
  /** Workspaces */
  activeWorkspace: DEFAULT_WORKSPACES[0],
  workspaces: DEFAULT_WORKSPACES,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  addWorkspace: (name, description) => {
    const newWorkspaceId = crypto.randomUUID();

    const newWorkspace: Workspace = {
      id: newWorkspaceId,
      name,
      description,
      keyBindings: [],
    };

    set((state) => {
      // Add the new workspace
      const newWorkspaces = [...state.workspaces, newWorkspace];

      // Initialize filters for the new workspace
      const commands = state.commandsCatalog;
      const telemetry = state.telemetryCatalog;

      const newWorkspaceFilters = {
        ...state.workspaceFilters,
        [newWorkspaceId]: {
          commands: createFullFilter(commands, state.boards),
          telemetry: createFullFilter(telemetry, state.boards),
          logs: createFullFilter(telemetry, state.boards),
        },
      };

      // Initialize expanded items for the new workspace
      const newExpandedItems = {
        ...state.expandedItems,
        [newWorkspaceId]: {
          commands: new Set<number | string>(),
          telemetry: new Set<number | string>(),
          logs: new Set<number | string>(),
        },
      };

      // Initialize active tab for the new workspace
      const newActiveTabs = {
        ...state.activeTab,
        [newWorkspaceId]: "commands" as SidebarTab,
      };

      // Initialize charts for the new workspace
      const newCharts = {
        ...state.charts,
        [newWorkspaceId]: [],
      };

      return {
        workspaces: newWorkspaces,
        activeWorkspace: newWorkspace, // Auto-switch to the new workspace
        workspaceFilters: newWorkspaceFilters,
        expandedItems: newExpandedItems,
        activeTab: newActiveTabs,
        charts: newCharts,
      };
    });
  },

  updateWorkspace: (id, name, description) => {
    set((state) => {
      const newWorkspaces = state.workspaces.map((workspace) =>
        workspace.id === id ? { ...workspace, name, description } : workspace,
      );

      // Update activeWorkspace if it's the one being edited
      const newActiveWorkspace =
        state.activeWorkspace?.id === id
          ? { ...state.activeWorkspace, name, description }
          : state.activeWorkspace;

      return {
        workspaces: newWorkspaces,
        activeWorkspace: newActiveWorkspace,
      };
    });
  },

  removeWorkspace: (id) => {
    set((state) => {
      const newWorkspaces = state.workspaces.filter(
        (workspace) => workspace.id !== id,
      );

      // Determine new active workspace
      let newActiveWorkspace = state.activeWorkspace;
      if (state.activeWorkspace?.id === id) {
        // If we're deleting the active workspace, switch to another one
        newActiveWorkspace = newWorkspaces[0] || null;
      }

      // Clean up workspace-specific data
      const newWorkspaceFilters = { ...state.workspaceFilters };
      const newExpandedItems = { ...state.expandedItems };
      const newActiveTabs = { ...state.activeTab };
      const newCharts = { ...state.charts };

      delete newWorkspaceFilters[id];
      delete newExpandedItems[id];
      delete newActiveTabs[id];
      delete newCharts[id];

      return {
        workspaces: newWorkspaces,
        activeWorkspace: newActiveWorkspace,
        workspaceFilters: newWorkspaceFilters,
        expandedItems: newExpandedItems,
        activeTab: newActiveTabs,
        charts: newCharts,
      };
    });
  },

  getActiveWorkspaceId: () => {
    const activeWorkspace = get().activeWorkspace;
    return activeWorkspace?.id ?? null;
  },

  // Key Bindings
  addKeyBinding: (commandId, key, parameters) => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    const bindingId = crypto.randomUUID();

    set((state) => {
      const updatedWorkspaces = state.workspaces.map((workspace) => {
        if (workspace.id === activeWorkspaceId) {
          return {
            ...workspace,
            keyBindings: [
              ...(workspace.keyBindings || []),
              { id: bindingId, commandId, key, parameters },
            ],
          };
        }
        return workspace;
      });

      const updatedActiveWorkspace = updatedWorkspaces.find(
        (w) => w.id === activeWorkspaceId,
      );

      return {
        workspaces: updatedWorkspaces,
        activeWorkspace: updatedActiveWorkspace || state.activeWorkspace,
      };
    });
  },

  removeKeyBinding: (bindingId) => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    set((state) => {
      const updatedWorkspaces = state.workspaces.map((workspace) => {
        if (workspace.id === activeWorkspaceId) {
          return {
            ...workspace,
            keyBindings: (workspace.keyBindings || []).filter(
              (binding) => binding.id !== bindingId,
            ),
          };
        }
        return workspace;
      });

      const updatedActiveWorkspace = updatedWorkspaces.find(
        (w) => w.id === activeWorkspaceId,
      );

      return {
        workspaces: updatedWorkspaces,
        activeWorkspace: updatedActiveWorkspace || state.activeWorkspace,
      };
    });
  },

  getKeyBindings: () => {
    const activeWorkspace = get().activeWorkspace;
    return activeWorkspace?.keyBindings || [];
  },

  getCommandIdsByKey: (key) => {
    const bindings = get().getKeyBindings();
    return bindings
      .filter((binding) => binding.key === key)
      .map((binding) => binding.commandId);
  },

  getKeyBindingForCommand: (commandId) => {
    const bindings = get().getKeyBindings();
    const binding = bindings.find((b) => b.commandId === commandId);
    return binding?.key;
  },

  getKeyBindingParameters: (commandId, key) => {
    const bindings = get().getKeyBindings();
    const binding = bindings.find(
      (b) => b.commandId === commandId && b.key === key,
    );
    return binding?.parameters;
  },
});
