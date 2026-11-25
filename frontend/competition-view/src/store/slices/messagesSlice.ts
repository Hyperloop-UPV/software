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

  // Terminal order: newest last, so the cap drops the oldest entries.
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message].slice(-MAX_MESSAGES),
    })),

  clearMessages: () => set({ messages: [] }),
});
