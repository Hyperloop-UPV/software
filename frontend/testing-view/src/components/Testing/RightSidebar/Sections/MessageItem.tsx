import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui";
import { ChevronDown } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useState } from "react";
import type { Message } from "../../../../types/data/message";

interface MessageItemProps {
  message: Message;
}

export const MessageItem = ({ message }: MessageItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const kindStyles: Record<Message["kind"], string> = {
    info: "border-blue-500 hover:bg-blue-500/5",
    warning: "border-yellow-500 hover:bg-yellow-500/5",
    fault: "border-red-500 hover:bg-red-500/5",
    ok: "border-green-500 hover:bg-green-500/5",
  };

  const formatTimestamp = (ts: Message["timestamp"]) => {
    return `${ts.hour.toString().padStart(2, "0")}:${ts.minute.toString().padStart(2, "0")}:${ts.second.toString().padStart(2, "0")}`;
  };

  const renderMessageContent = (payload: any) => {
    // 1. Simple string (Info messages)
    if (typeof payload === "string") return payload;

    // 2. Protection object
    if (payload && typeof payload === "object") {
      const { kind, data } = payload;

      // Handle string-based data (ERROR_HANDLER, WARNING)
      if (typeof data === "string") return data;

      // Handle numeric bounds (OUT_OF_BOUNDS, UPPER_BOUND, etc.)
      if (kind === "OUT_OF_BOUNDS" && data.bounds) {
        return `Value: ${data.value} (Bounds: [${data.bounds[0]}, ${data.bounds[1]}])`;
      }

      if (kind === "UPPER_BOUND" || kind === "LOWER_BOUND") {
        return `Value: ${data.value} (Limit: ${data.bound})`;
      }

      // Fallback for complex data objects
      return JSON.stringify(data);
    }

    return "No detail available";
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "bg-accent/30 border-l-4 transition-all",
        kindStyles[message.kind] || "border-muted",
      )}
    >
      <CollapsibleTrigger className="flex w-full flex-col items-start">
        <div className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          <span className="text-muted-foreground shrink-0 font-mono text-sm">
            {formatTimestamp(message.timestamp)}
          </span>

          <Badge
            variant="destructive"
            className="h-4.5 shrink-0 px-1.5 text-[11px] uppercase"
          >
            {message.board}
          </Badge>

          <span className="flex-1 truncate text-sm font-medium">
            {message.name}
          </span>

          <ChevronDown
            className={cn(
              "text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>

        <CollapsibleContent className="w-full cursor-auto select-text px-3 pb-2 pt-0 text-xs">
          <div onClick={(e) => e.stopPropagation()}>
            <div className="flex w-full items-end justify-between gap-1">
              {/* If it's a protection message, showing the sub-kind can be helpful */}
              {message.payload?.kind && (
                <span className="text-muted-foreground text-[10px] font-bold uppercase opacity-70">
                  {message.payload.kind.replace("_", " ")}
                </span>
              )}
              <p className="whitespace-pre-wrap font-medium leading-relaxed">
                {renderMessageContent(message.payload)}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </CollapsibleTrigger>
    </Collapsible>
  );
};
