import { Separator } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import type { Board } from "../types";
import { StatusDot } from "./status-dot";

type Props = {
  board: Board;
  selected: boolean;
  onSelect: () => void;
};

export function BoardCard({ board, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border px-3 py-3 text-left transition-colors w-full",
        "bg-background hover:bg-secondary/70",
        selected && "border-primary/60 bg-primary/8",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2 font-medium text-foreground">
          <StatusDot state={board.operational_state} />
          <span className="truncate">{board.name}</span>
        </div>

        <div
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary" : "border-input bg-background",
          )}
        >
          {selected && <div className="size-1.5 rounded-full bg-primary-foreground" />}
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-0.5 text-xs text-muted-foreground uppercase">
        <div>{board.operational_state}</div>
        <div>{board.flashing_state}</div>
      </div>
    </button>
  );
}
