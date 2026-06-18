import type { StateCreator } from "zustand";
import type { Connection } from "../../types/connection";
import type { Store } from "../store";

export interface ConnectionsSlice {
  connections: Record<string, Connection>;
  updateConnections: (incoming: Record<string, Connection>) => void;
}

export const createConnectionsSlice: StateCreator<
  Store,
  [],
  [],
  ConnectionsSlice
> = (set) => ({
  connections: {},

  updateConnections: (incoming) =>
    set((state) => ({
      connections: { ...state.connections, ...incoming },
    })),
});
