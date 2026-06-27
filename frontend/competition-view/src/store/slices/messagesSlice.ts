import type { StateCreator } from "zustand";
import type { Message } from "../../types/message";
import type { Store } from "../store";

const MAX_MESSAGES = 500;

export interface MessagesSlice {
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

export const createMessagesSlice: StateCreator<
  Store,
  [],
  [],
  MessagesSlice
> = (set) => ({
  messages: [],

  addMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages].slice(0, MAX_MESSAGES),
    })),

  clearMessages: () => set({ messages: [] }),
});
