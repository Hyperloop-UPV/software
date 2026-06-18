import { Badge } from "@workspace/ui/components";
import type { Message, MessageKind } from "../../../types/message";

const KIND_BADGE_CLASS: Record<MessageKind, string> = {
  info:    "border-blue-300  bg-blue-50   text-blue-700  dark:border-blue-700  dark:bg-blue-900/20  dark:text-blue-400",
  warning: "border-amber-300 bg-amber-50  text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  error:   "border-red-300   bg-red-50    text-red-700   dark:border-red-700   dark:bg-red-900/20   dark:text-red-400",
  debug:   "border-border    bg-muted     text-muted-foreground",
};

const KIND_ROW_CLASS: Record<MessageKind, string> = {
  info:    "",
  warning: "bg-amber-50/40 dark:bg-amber-900/10",
  error:   "bg-red-50/40   dark:bg-red-900/10",
  debug:   "",
};

interface MessageItemProps {
  message: Message;
}

const MessageItem = ({ message }: MessageItemProps) => {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className={`flex items-start gap-3 border-b px-4 py-2 last:border-0 ${KIND_ROW_CLASS[message.kind]}`}>
      <span className="text-muted-foreground w-20 shrink-0 pt-0.5 font-mono text-xs">
        {time}
      </span>
      <Badge
        variant="outline"
        className={`shrink-0 text-[10px] font-semibold uppercase ${KIND_BADGE_CLASS[message.kind]}`}
      >
        {message.kind}
      </Badge>
      <span className="text-foreground min-w-0 break-words text-sm">
        {message.content}
      </span>
    </div>
  );
};

export default MessageItem;
