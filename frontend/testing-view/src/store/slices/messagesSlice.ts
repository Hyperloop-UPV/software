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
    set((state) => ({
      messages: [message, ...state.messages].slice(0, MAX_MESSAGES),
    })),
  clearMessages: () => set({ messages: [] }),
});
