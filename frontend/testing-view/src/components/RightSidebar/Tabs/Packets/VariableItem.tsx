import { Badge } from "@workspace/ui";
import type { Variable } from "../../../../types/Packet";
import { getTypeBadgeClass } from "../../../../lib/utils";
import { cn } from "@workspace/ui/lib";

interface VariableItemProps {
  variable: Variable;
}

export const VariableItem = ({ variable }: VariableItemProps) => {
  return (
    <div className="flex items-center justify-between gap-2.5 border-t px-3 py-1.5 first:border-t-0">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "rounded px-1 py-0.5 text-xs font-semibold uppercase",
            getTypeBadgeClass(variable.type),
          )}
          title={`Type: ${variable.type}`}
        >
          {variable.type}
        </Badge>
        {/* Variable name */}
        <span className="text-muted-foreground truncate text-xs">
          {variable.name}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Value */}
        <span className="text-foreground shrink-0 font-mono text-xs font-semibold">
          {variable.value}
        </span>

        {/* Unit */}
        <span className="text-muted-foreground shrink-0 text-xs">
          {variable.unit}
        </span>
      </div>
    </div>
  );
};
