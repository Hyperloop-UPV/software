import { Badge } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import type { Board } from "../types";

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
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium text-foreground">{board.name}</span>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full text-xs",
              board.accessible
                ? "border-green-500/40 bg-green-500/15 text-green-600 dark:text-green-400"
                : "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400",
            )}
          >
            {board.accessible ? "Accessible" : "Unreachable"}
          </Badge>

          <div
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
              selected ? "border-primary bg-primary" : "border-input bg-background",
            )}
          >
            {selected && <div className="size-1.5 rounded-full bg-primary-foreground" />}
          </div>
        </div>
      </div>
    </button>
  );
}
