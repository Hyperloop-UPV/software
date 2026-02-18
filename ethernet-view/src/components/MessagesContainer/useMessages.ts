import { MessageAdapter, useSubscribe } from "common";
import { useMessagesStore } from "common";

export function useMessages() {
    const { messages, addMessage } = useMessagesStore(state => ({messages: state.messages, addMessage: state.addMessage}));

    useSubscribe("message/update", (msg: MessageAdapter) => addMessage(msg));

    return messages;
}
