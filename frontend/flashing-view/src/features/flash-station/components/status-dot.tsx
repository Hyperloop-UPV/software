import { Circle } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";
import type { BoardState } from "../types";

const STATE_COLOR: Record<BoardState, string> = {
  connected: "text-green-600",
  offline: "text-slate-400",
};

/** Tiny coloured dot shown next to a board name to indicate its online status. */
export function StatusDot({ state }: { state: BoardState }) {
  return (
    <Circle className={cn("size-3 fill-current", STATE_COLOR[state])} />
  );
}
