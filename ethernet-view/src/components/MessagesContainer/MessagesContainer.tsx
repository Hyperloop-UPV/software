import { Messages } from "./Messages/Messages";
import { useMessages } from "components/MessagesContainer/useMessages";

export const MessagesContainer = () => {
    const messages = useMessages();
    return <Messages messages={messages} />;
};
