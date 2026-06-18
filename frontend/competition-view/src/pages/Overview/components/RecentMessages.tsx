import { Badge, Separator } from "@workspace/ui/components";
import { useStore } from "../../../store/store";
import type { Message, MessageKind } from "../../../types/message";

const KIND_BADGE_CLASS: Record<MessageKind, string> = {
  info:    "border-blue-300  text-blue-700  dark:border-blue-700  dark:text-blue-400",
  warning: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  error:   "border-red-300   text-red-700   dark:border-red-700   dark:text-red-400",
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
      <Badge
        variant="outline"
        className={`shrink-0 text-[10px] font-semibold uppercase ${KIND_BADGE_CLASS[message.kind]}`}
      >
        {message.kind}
      </Badge>
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
