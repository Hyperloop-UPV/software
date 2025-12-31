import type { StateCreator } from "zustand";
import type { Connection } from "../../types/common/connection";

export interface ConnectionsSlice {
  connections: Record<string, Connection>;
  updateConnections: (data: Record<string, Connection>) => void;
}

export const createConnectionsSlice: StateCreator<ConnectionsSlice> = (
  set,
) => ({
  connections: {},

  updateConnections: (data) =>
    set((state) => ({
      connections: {
        ...state.connections,
        ...data,
      },
    })),
});
