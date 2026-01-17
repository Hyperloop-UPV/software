import type { StateCreator } from "zustand";
import type { Message } from "../../types/data/message";
import type { Store } from "../store";

export interface MessagesSlice {
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

const MAX_MESSAGES = 200;

export const createMessagesSlice: StateCreator<Store, [], [], MessagesSlice> = (
  set,
) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => {
      // Avoid duplicate messages if they have the same ID
      const messageExists = state.messages.some((m) => m.id === message.id);
      if (messageExists) return state;

      // Add to start of array and limit to 200
      return {
        messages: [message, ...state.messages].slice(0, MAX_MESSAGES),
      };
    }),
  clearMessages: () => set({ messages: [] }),
});
