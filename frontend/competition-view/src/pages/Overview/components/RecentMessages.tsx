import { Separator } from "@workspace/ui/components";
import { useStore } from "../../../store/store";
import type { Message, MessageKind } from "../../../types/message";

const KIND_STYLES: Record<MessageKind, string> = {
  info:    "text-blue-500",
  warning: "text-amber-500",
  error:   "text-red-500",
  debug:   "text-muted-foreground",
};

const MAX_VISIBLE = 6;

interface MessageRowProps {
  message: Message;
}

const MessageRow = ({ message }: MessageRowProps) => {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-start gap-3 py-1 text-sm">
      <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs">
        {time}
      </span>
      <span
        className={`shrink-0 w-14 font-semibold uppercase text-xs ${KIND_STYLES[message.kind]}`}
      >
        {message.kind}
      </span>
      <span className="text-foreground min-w-0 truncate">{message.content}</span>
    </div>
  );
};

/**
 * Shows the most recent system messages in a compact panel.
 * Full message history is available on the Messages page.
 */
const RecentMessages = () => {
  const messages = useStore((s) => s.messages);
  const recent = messages.slice(0, MAX_VISIBLE);

  return (
    <div className="bg-card flex flex-col rounded-xl border shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Recent Messages
        </span>
        <span className="text-muted-foreground text-xs">{messages.length} total</span>
      </div>
      <Separator />
      <div className="px-4 py-2">
        {recent.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-xs">
            No messages yet
          </p>
        ) : (
          recent.map((msg) => <MessageRow key={msg.id} message={msg} />)
        )}
      </div>
    </div>
  );
};

export default RecentMessages;
