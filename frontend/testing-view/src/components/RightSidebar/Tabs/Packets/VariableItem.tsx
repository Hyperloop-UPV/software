import { Badge } from "@workspace/ui";
import type { Variable } from "../../../../types/Packet";
import { getTypeBadgeClass } from "../../../../lib/utils";
import { cn } from "@workspace/ui/lib";
import { Check, X } from "@workspace/ui/icons";

interface VariableItemProps {
  variable: Variable;
  liveValue?:
    | {
        average: number;
        last: number;
      }
    | boolean
    | string
    | number;
}

export const VariableItem = ({ variable, liveValue }: VariableItemProps) => {
  console.log(liveValue, variable);
  const renderValue = () => {
    // Case 1: Object with average/last
    if (typeof liveValue === "object" && liveValue !== null) {
      if ("average" in liveValue && "last" in liveValue) {
        return (
          <div className="flex flex-col items-end leading-tight">
            <span className="text-primary font-mono text-sm font-bold">
              {liveValue.last.toFixed(2)}
            </span>
            <span className="text-muted-foreground text-[12px] opacity-70">
              avg: {liveValue.average.toFixed(2)}
            </span>
          </div>
        );
      }
    }

    // Case 2: Boolean
    if (typeof liveValue === "boolean") {
      return liveValue ? (
        <Badge
          variant="default"
          className="bg-green-500/20 p-1 text-green-500 hover:bg-green-500/20"
        >
          <Check className="h-3 w-3" />
        </Badge>
      ) : (
        <Badge
          variant="destructive"
          className="bg-red-500/20 p-1 text-red-500 hover:bg-red-500/20"
        >
          <X className="h-3 w-3" />
        </Badge>
      );
    }

    // Case 3: String or Number (Default)
    return (
      <span
        className={cn(
          "shrink-0 font-mono text-xs font-semibold",
          liveValue !== undefined ? "text-primary" : "text-foreground",
        )}
      >
        {liveValue === undefined
          ? "unknown"
          : typeof liveValue === "number"
            ? liveValue.toFixed(2)
            : String(liveValue)}
      </span>
    );
  };

  return (
    <div className="flex items-center justify-between gap-2.5 border-t py-1.5 pl-6 pr-3 first:border-t-0">
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
        {renderValue()}

        {/* Unit */}
        <span className="text-muted-foreground shrink-0 text-xs">
          {variable.units}
        </span>
      </div>
    </div>
  );
};
