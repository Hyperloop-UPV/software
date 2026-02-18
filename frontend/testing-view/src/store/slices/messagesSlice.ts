import type { StateCreator } from "zustand";
import { config } from "../../../config";
import type { Message } from "../../types/data/message";
import type { Store } from "../store";

export interface MessagesSlice {
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

export const createMessagesSlice: StateCreator<Store, [], [], MessagesSlice> = (
  set,
) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages].slice(
        0,
        config.MAX_MESSAGES_COUNT,
      ),
    })),
  clearMessages: () => set({ messages: [] }),
});
