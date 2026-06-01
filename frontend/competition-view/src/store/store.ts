import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAppSlice, type AppSlice } from "./slices/appSlice";
import {
  createConnectionsSlice,
  type ConnectionsSlice,
} from "./slices/connectionsSlice";
import {
  createMessagesSlice,
  type MessagesSlice,
} from "./slices/messagesSlice";
import {
  createTelemetrySlice,
  type TelemetrySlice,
} from "./slices/telemetrySlice";

export type Store = AppSlice &
  ConnectionsSlice &
  MessagesSlice &
  TelemetrySlice;

export const useStore = create<Store>()(
  persist(
    (...a) => ({
      ...createAppSlice(...a),
      ...createConnectionsSlice(...a),
      ...createMessagesSlice(...a),
      ...createTelemetrySlice(...a),
    }),
    {
      name: "competition-view-storage",
      version: 1,
      // Only persist lightweight user-preference data, never live telemetry.
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
      }),
    },
  ),
);
