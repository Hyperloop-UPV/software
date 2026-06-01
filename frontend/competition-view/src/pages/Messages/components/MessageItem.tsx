import type { Message, MessageKind } from "../../../types/message";

const KIND_STYLES: Record<MessageKind, { badge: string; row: string }> = {
  info:    { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    row: "" },
  warning: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", row: "bg-amber-50/50 dark:bg-amber-900/10" },
  error:   { badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         row: "bg-red-50/50 dark:bg-red-900/10" },
  debug:   { badge: "bg-muted text-muted-foreground",                                        row: "" },
};

interface MessageItemProps {
  message: Message;
}

const MessageItem = ({ message }: MessageItemProps) => {
  const { badge, row } = KIND_STYLES[message.kind];

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className={`flex items-start gap-3 border-b px-4 py-2 last:border-0 ${row}`}>
      <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs pt-0.5">
        {time}
      </span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${badge}`}>
        {message.kind}
      </span>
      <span className="text-foreground min-w-0 break-words text-sm">
        {message.content}
      </span>
    </div>
  );
};

export default MessageItem;
