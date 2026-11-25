import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@hyperloopupv/frontend-kit";
import { ChevronDown } from "@hyperloopupv/frontend-kit/icons";
import { cn } from "@hyperloopupv/frontend-kit/lib";
import { Rows3, Shield, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { MESSAGE_KIND_BADGES, MESSAGE_KIND_COLORS } from "../../../../../constants/messageKindColors";
import { formatTimestamp } from "../../../../../lib/utils";
import type { Message } from "../../../../../types/data/message";

interface MessageItemProps {
  message: Message;
}

export const MessageItem = ({ message }: MessageItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  let label = "Backend";
  let Icon: LucideIcon | undefined = Rows3;
  if (message.category === "protection") {
    label = `${message.board}`;
    Icon = Shield;
  } else if (message.category === "message") {
    label = `${message.board}`;
    Icon = undefined;
  }

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
        MESSAGE_KIND_COLORS[message.kind] || "border-muted",
      )}
    >
      <CollapsibleTrigger className="flex w-full flex-col items-start">
        <div className="flex w-full items-start gap-2 px-3 py-2.5 text-left">
          <span className="text-muted-foreground shrink-0 font-mono text-sm">
            {formatTimestamp(message.timestamp)}
          </span>
            <span className="text-muted-foreground shrink-0 font-mono text-sm">
              <Badge
                //  variant="default"
                className={cn("h-4.5 shrink-0 px-1.5 text-[11px]", MESSAGE_KIND_BADGES[message.kind])}
              >
                {label}
              </Badge>
            </span>

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

        {/* Block (not flex) so the floated icon sits under the time and the
            expanded text flows to its right, then wraps underneath it. */}
        <div
          className={cn(
            "flow-root w-full px-3 text-left",
            (Icon || isOpen) && "pb-2",
          )}
        >
          {Icon && (
            // Same font as the timestamp, so 8ch = width of "HH:MM:SS"
            <span className="float-left mb-1 mr-2 flex w-[8ch] justify-center font-mono text-sm">
              <Icon
                aria-hidden="true"
                className="text-muted-foreground h-6 w-6"
              />
            </span>
          )}
          <CollapsibleContent className="cursor-auto select-text text-xs">
            <div onClick={(e) => e.stopPropagation()}>
              {/* If it's a detailed message, showing the sub-kind can be helpful */}
              {message.payload &&
                typeof message.payload === "object" &&
                message.payload.kind && (
                  <span className="text-muted-foreground block text-[10px] font-bold uppercase opacity-70">
                    {message.payload.kind.replace("_", " ")}
                  </span>
                )}
              <p className="whitespace-pre-wrap font-medium leading-relaxed">
                {renderMessageContent(message.payload)}
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </CollapsibleTrigger>
    </Collapsible>
  );
};
