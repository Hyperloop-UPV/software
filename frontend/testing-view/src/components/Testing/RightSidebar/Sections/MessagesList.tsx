import { useStore } from "../../../../store/store";
import { MessageItem } from "./MessageItem";

export const MessagesList = () => {
  const messages = useStore((s) => s.messages);

  return (
    <div className="flex h-full flex-col border-t">
      {/* Message Entries */}
      <div className="flex h-full flex-col space-y-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs italic">
            No messages received
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
      </div>
    </div>
  );
};
