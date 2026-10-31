import { Badge } from "@hyperloop-upv/frontend-kit/components";
import { memo } from "react";
import { formatMessageTimestamp, messageContent } from "../../../lib/message";
import type { Message, MessageKind } from "../../../types/message";

const KIND_BADGE_CLASS: Record<MessageKind, string> = {
  info:    "border-blue-300  bg-blue-50   text-blue-700  dark:border-blue-700  dark:bg-blue-900/20  dark:text-blue-400",
  warning: "border-amber-300 bg-amber-50  text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  fault:   "border-red-300   bg-red-50    text-red-700   dark:border-red-700   dark:bg-red-900/20   dark:text-red-400",
  ok:      "border-green-300 bg-green-50  text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400",
};

const KIND_ROW_CLASS: Record<MessageKind, string> = {
  info:    "",
  warning: "bg-amber-100 dark:bg-amber-900/10",
  fault:   "bg-red-100   dark:bg-red-900/10",
  ok:      "",
};

interface MessageItemProps {
  message: Message;
  /** Body text size. "base" (default) is used by the dedicated Messages page; the compact Overview panel passes "sm". Ignored when `fontSizePx` is set. */
  size?: "sm" | "base";
  /** Overrides `size` with an exact pixel size, driven by the Messages page's font-size slider. */
  fontSizePx?: number;
}

// Memoised: message objects are immutable, so once rendered a row never
// changes — this keeps a new message from re-rendering the whole list.
/** Badge-to-body ratio that keeps the slider's 16px default at the original 10px badge. */
const BADGE_SIZE_RATIO = 10 / 16;
const MIN_BADGE_SIZE_PX = 10;

const MessageItem = memo(({ message, size = "base", fontSizePx }: MessageItemProps) => {
  const time = formatMessageTimestamp(message.timestamp);
  const badgeSizePx = fontSizePx
    ? Math.max(MIN_BADGE_SIZE_PX, Math.round(fontSizePx * BADGE_SIZE_RATIO))
    : undefined;

  return (
    <div className={`flex items-start gap-3 border-b px-4 py-2 last:border-0 ${KIND_ROW_CLASS[message.kind]}`}>
      <span className="text-muted-foreground w-20 shrink-0 pt-0.5 font-mono text-xs">
        {time}
      </span>
      <Badge
        variant="outline"
        className={`shrink-0 font-semibold uppercase ${badgeSizePx ? "" : "text-[10px]"} ${KIND_BADGE_CLASS[message.kind]}`}
        style={badgeSizePx ? { fontSize: `${badgeSizePx}px` } : undefined}
      >
        {message.kind}
      </Badge>
      <span
        className={`text-foreground min-w-0 break-words ${fontSizePx ? "" : size === "base" ? "text-base" : "text-sm"}`}
        style={fontSizePx ? { fontSize: `${fontSizePx}px` } : undefined}
      >
        {messageContent(message.payload)}
      </span>
    </div>
  );
});

MessageItem.displayName = "MessageItem";
export default MessageItem;
