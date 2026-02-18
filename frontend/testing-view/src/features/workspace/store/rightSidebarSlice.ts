import type { StateCreator } from "zustand";
import type { Store } from "../../../store/store";

export interface RightSidebarSlice {
  // Section visibility
  isMessagesVisible: boolean;
  isTelemetryVisible: boolean;
  isCommandsVisible: boolean;
  toggleTelemetry: () => void;
  toggleCommands: () => void;
  toggleMessages: () => void;

  // Layout settings
  isHorizontal: boolean;
  toggleLayout: () => void;

  // Computed values
  getNoneVisible: () => boolean;
}

export const createRightSidebarSlice: StateCreator<
  Store,
  [],
  [],
  RightSidebarSlice
> = (set, get) => ({
  // Section visibility
  isTelemetryVisible: true,
  isCommandsVisible: true,
  isMessagesVisible: true,
  toggleTelemetry: () => set({ isTelemetryVisible: !get().isTelemetryVisible }),
  toggleCommands: () => set({ isCommandsVisible: !get().isCommandsVisible }),
  toggleMessages: () => set({ isMessagesVisible: !get().isMessagesVisible }),

  // Layout settings
  isHorizontal: false,
  toggleLayout: () => set({ isHorizontal: !get().isHorizontal }),

  // Computed values
  getNoneVisible: () => !get().isTelemetryVisible && !get().isMessagesVisible,
});
