import { Button, Separator, Slider } from "@hyperloop-upv/frontend-kit/components";
import { ChevronDown } from "@hyperloop-upv/frontend-kit/icons";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/store";
import type { MessageKind } from "../../types/message";
import MessageItem from "./components/MessageItem";

const ALL_KINDS: MessageKind[] = ["info", "warning", "fault", "ok"];

const KIND_LABEL: Record<MessageKind, string> = {
  info:    "Info",
  warning: "Warning",
  fault:   "Fault",
  ok:      "Ok",
};

const FONT_SIZE_KEY = "messages.fontSize";
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 16;

const readStoredFontSize = () => {
  const stored = Number(localStorage.getItem(FONT_SIZE_KEY));
  return stored >= MIN_FONT_SIZE && stored <= MAX_FONT_SIZE ? stored : DEFAULT_FONT_SIZE;
};

/**
 * Full message log with per-kind filtering and a clear button.
 *
 * Terminal-style log: messages are stored oldest-first, so the latest entry
 * is at the bottom and the view follows it. A floating "Latest" button
 * appears once the user scrolls up into history, which also pauses the
 * auto-scroll until they return to the bottom.
 */
const Messages = () => {
  const messages      = useStore((s) => s.messages);
  const clearMessages = useStore((s) => s.clearMessages);

  const [activeKinds, setActiveKinds] = useState<Set<MessageKind>>(
    new Set(ALL_KINDS),
  );
  const [scrolledAway, setScrolledAway] = useState(false);
  const [fontSize, setFontSize] = useState(readStoredFontSize);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const prevLenRef   = useRef(0);

  const toggleKind = (kind: MessageKind) =>
    setActiveKinds((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });

  const filtered = messages.filter((m) => activeKinds.has(m.kind));

  // Jumps instantly: a smooth scroll still in flight when the next message
  // lands would read as "scrolled away" and stall the follow.
  const scrollToLatest = (behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Follow the bottom as entries arrive, unless the user scrolled up.
  useEffect(() => {
    if (filtered.length > prevLenRef.current && !scrolledAway) {
      scrollToLatest();
    }
    prevLenRef.current = filtered.length;
  }, [filtered.length, scrolledAway]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrolledAway(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Filter
        </span>
        {ALL_KINDS.map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant={activeKinds.has(kind) ? "default" : "outline"}
            onClick={() => toggleKind(kind)}
            className="rounded-full text-xs"
          >
            {KIND_LABEL[kind]}
          </Button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs" aria-hidden>A</span>
            <Slider
              value={[fontSize]}
              onValueChange={([value]) => setFontSize(value)}
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              className="w-24"
              aria-label="Message font size"
            />
            <span className="text-muted-foreground text-base" aria-hidden>A</span>
          </div>
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
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
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">No messages</p>
          </div>
        ) : (
          filtered.map((msg) => (
            <MessageItem key={msg.id} message={msg} fontSizePx={fontSize} />
          ))
        )}

        {/* Floating "scroll to latest" button */}
        {scrolledAway && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => scrollToLatest("smooth")}
            className="fixed bottom-6 right-6 z-10 gap-1.5 shadow-md"
          >
            <ChevronDown className="size-3.5" />
            Latest
          </Button>
        )}
      </div>
    </div>
  );
};

export default Messages;
