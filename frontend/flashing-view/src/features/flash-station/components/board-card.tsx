import { Plug } from "lucide-react";
import { Separator } from "@workspace/ui/components/shadcn/separator";
import { cn } from "@workspace/ui/lib/utils";
import type { Board } from "../types";
import { getBoardDisplayStatus } from "../utils";
import { StatusDot } from "./status-dot";

type Props = {
  board: Board;
  selected: boolean;
  disabled: boolean;
  isFlashing: boolean;
  activeBoardId: string | null;
  onSelect: (boardId: string, checked: boolean) => void;
};

/**
 * Clickable card representing a single board in the grid.
 *
 * Offline boards are visually dimmed and ignore clicks. The radio circle on
 * the right indicates which board is currently armed for flashing.
 */
export function BoardCard({
  board,
  selected,
  disabled,
  isFlashing,
  activeBoardId,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "rounded-xl border px-3 py-3 text-left transition-colors",
        "bg-background hover:bg-secondary/70",
        selected && "border-primary/60 bg-primary/8",
        disabled && "cursor-not-allowed opacity-60",
      )}
      onClick={() => onSelect(board.id, !selected)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2 font-medium text-foreground">
          <StatusDot state={board.state} />
          <span className="truncate">{board.name}</span>
        </div>

        {/* Radio indicator — filled when this board is armed. */}
        <div
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-primary bg-primary"
              : "border-input bg-background",
          )}
        >
          {selected && (
            <div className="size-1.5 rounded-full bg-primary-foreground" />
          )}
        </div>
      </div>

      <Separator className="my-3" />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Plug className="size-3.5" />
        <span className="uppercase">
          {getBoardDisplayStatus(board, activeBoardId, isFlashing)}
        </span>
      </div>
    </button>
  );
}
