import { Button, Separator } from "@workspace/ui/components";
import { useState } from "react";
import { useStore } from "../../store/store";
import type { MessageKind } from "../../types/message";
import MessageItem from "./components/MessageItem";

const ALL_KINDS: MessageKind[] = ["info", "warning", "error", "debug"];

const KIND_LABEL: Record<MessageKind, string> = {
  info:    "Info",
  warning: "Warning",
  error:   "Error",
  debug:   "Debug",
};

/**
 * Full message log with per-kind filtering and a clear button.
 */
const Messages = () => {
  const messages     = useStore((s) => s.messages);
  const clearMessages = useStore((s) => s.clearMessages);

  const [activeKinds, setActiveKinds] = useState<Set<MessageKind>>(
    new Set(ALL_KINDS),
  );

  const toggleKind = (kind: MessageKind) =>
    setActiveKinds((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });

  const filtered = messages.filter((m) => activeKinds.has(m.kind));

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Filter
        </span>
        {ALL_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => toggleKind(kind)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeKinds.has(kind)
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {KIND_LABEL[kind]}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {filtered.length} / {messages.length}
          </span>
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          <Button
            variant="outline"
            size="sm"
            onClick={clearMessages}
            disabled={messages.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">No messages</p>
          </div>
        ) : (
          filtered.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
      </div>
    </div>
  );
};

export default Messages;
