// Two-step signal picker: opening it lists the boards first (plus a
// "Composed" entry for operations/transforms); choosing a board drills into
// its series with a filter box and a back button. Built on Popover because
// Radix Select cannot nest levels.
import { Input, Popover, PopoverContent, PopoverTrigger } from "@hyperloop-upv/frontend-kit/components";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useState } from "react";
import { useAvailableSignals, type AvailableSignal } from "./hooks/useStudioSignals";

// Sentinel board key for the composed-signals group
const COMPOSED = "__composed__";

interface SignalSelectProps {
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  /** Signal ids to hide (e.g. already assigned to the plot). */
  exclude?: string[];
  triggerClassName?: string;
  size?: "sm" | "default";
}

const glyphFor = (kind: AvailableSignal["kind"]) =>
  kind === "operation" ? "∑" : kind === "transform" ? "𝑓" : null;

export default function SignalSelect({
  value,
  onValueChange,
  placeholder = "Select signal…",
  exclude,
  triggerClassName,
  size = "default",
}: SignalSelectProps) {
  const signals = useAvailableSignals();
  const [open, setOpen] = useState(false);
  // null → board list; a board name (or COMPOSED) → its series list
  const [activeBoard, setActiveBoard] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Keyboard-highlighted row in the step-2 series list (arrow keys move it,
  // Enter picks it). Reset to 0 at every call site that changes query or
  // activeBoard, since either invalidates which row "top of list" refers to.
  const [highlightIndex, setHighlightIndex] = useState(0);

  const excluded = new Set(exclude ?? []);
  const byBoard = new Map<string, AvailableSignal[]>();
  const composed: AvailableSignal[] = [];
  for (const s of signals) {
    if (excluded.has(s.id)) continue;
    if (s.board) {
      const arr = byBoard.get(s.board);
      if (arr) { arr.push(s); } else { byBoard.set(s.board, [s]); }
    } else {
      composed.push(s);
    }
  }
  const boardNames = [...byBoard.keys()].sort((a, b) => a.localeCompare(b));
  const empty = boardNames.length === 0 && composed.length === 0;

  const selected = signals.find((s) => s.id === value);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setQuery("");
      setHighlightIndex(0);
      // Skip the board step when there is only one group to choose from
      if (boardNames.length === 1 && composed.length === 0) {
        setActiveBoard(boardNames[0]);
      } else if (boardNames.length === 0 && composed.length > 0) {
        setActiveBoard(COMPOSED);
      } else {
        setActiveBoard(null);
      }
    }
  };

  const pick = (id: string) => {
    onValueChange(id);
    setOpen(false);
  };

  const activeItems = activeBoard === COMPOSED ? composed : (byBoard.get(activeBoard ?? "") ?? []);
  const q = query.trim().toLowerCase();
  const visibleItems = q
    ? activeItems.filter((s) => s.label.toLowerCase().includes(q))
    : activeItems;
  const safeHighlight =
    visibleItems.length === 0 ? -1 : Math.min(Math.max(highlightIndex, 0), visibleItems.length - 1);

  return (
    // modal=true — this picker is used inside Dialogs (OperationModal,
    // TransformModal); Radix's Popover otherwise fights the Dialog's own
    // scroll-lock, leaving the board's measurement list unscrollable
    // (documented Radix issue: nested Popover-in-Dialog wheel scroll is
    // blocked unless the Popover itself is also modal).
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border bg-transparent px-3 outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" ? "text-xs" : "text-sm",
            triggerClassName,
          )}
        >
          <span className="min-w-0 truncate text-left">
            {selected ? (
              selected.board ? (
                <>
                  <span className="text-muted-foreground">{selected.board}/</span>
                  {selected.label}
                </>
              ) : (
                <>
                  <span className="text-muted-foreground mr-1">{glyphFor(selected.kind)}</span>
                  {selected.label}
                </>
              )
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-52 p-0">
        {activeBoard === null ? (
          /* Step 1 — pick a board */
          <div className="max-h-72 overflow-y-auto p-1">
            {empty && (
              <div className="text-muted-foreground px-2 py-3 text-center text-[11px]">
                No series available — open a session first
              </div>
            )}
            {boardNames.map((board) => (
              <button
                key={board}
                type="button"
                onClick={() => { setActiveBoard(board); setQuery(""); setHighlightIndex(0); }}
                className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{board}</span>
                <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                  {byBoard.get(board)!.length}
                </span>
                <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
              </button>
            ))}
            {composed.length > 0 && (
              <button
                type="button"
                onClick={() => { setActiveBoard(COMPOSED); setQuery(""); setHighlightIndex(0); }}
                className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors"
              >
                <span className="text-muted-foreground shrink-0">∑𝑓</span>
                <span className="min-w-0 flex-1 truncate font-medium">Composed</span>
                <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">{composed.length}</span>
                <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
              </button>
            )}
          </div>
        ) : (
          /* Step 2 — pick a series within the board */
          <div>
            <div className="flex items-center gap-1 border-b px-1 py-1">
              <button
                type="button"
                onClick={() => setActiveBoard(null)}
                aria-label="Back to boards"
                className="hover:bg-accent rounded-sm p-1 transition-colors"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                {activeBoard === COMPOSED ? "Composed" : activeBoard}
              </span>
            </div>

            <div className="relative border-b">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlightIndex(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.min(i + 1, visibleItems.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && safeHighlight >= 0) {
                    pick(visibleItems[safeHighlight].id);
                  }
                }}
                placeholder="Filter…"
                className="h-8 rounded-none border-0 pl-8 text-xs shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="max-h-60 overflow-y-auto p-1">
              {visibleItems.length === 0 && (
                <div className="text-muted-foreground px-2 py-3 text-center text-[11px]">
                  No matches
                </div>
              )}
              {visibleItems.map((s, idx) => (
                <button
                  key={s.id}
                  ref={(el) => {
                    if (idx === safeHighlight) el?.scrollIntoView({ block: "nearest" });
                  }}
                  type="button"
                  onClick={() => pick(s.id)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                    idx === safeHighlight && "bg-accent text-accent-foreground",
                  )}
                >
                  {glyphFor(s.kind) && (
                    <span className="text-muted-foreground shrink-0">{glyphFor(s.kind)}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {s.id === value && <Check className="text-primary size-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
