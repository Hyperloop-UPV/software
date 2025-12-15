import { Badge } from "@workspace/ui";
import type { Variable } from "../../../types/Packet";

interface VariableItemProps {
  variable: Variable;
}

export const VariableItem = ({ variable }: VariableItemProps) => {
  // Get type-specific styling for Badge
  const getTypeBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case "float":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20";
      case "integer":
      case "int":
        return "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20";
      case "string":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/20";
      case "boolean":
      case "bool":
        return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20";
      default:
        return "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30 hover:bg-muted-foreground/20";
    }
  };

  return (
    <div className="flex items-center justify-between gap-2.5 border-t px-3 py-1.5 first:border-t-0">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none ${getTypeBadgeClass(variable.type)}`}
          title={`Type: ${variable.type}`}
        >
          {variable.type}
        </Badge>
        {/* Variable name */}
        <span className="text-muted-foreground truncate text-sm">
          {variable.name}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Value */}
        <span className="text-foreground shrink-0 font-mono text-sm font-semibold">
          {variable.value}
        </span>

        {/* Unit */}
        <span className="text-muted-foreground shrink-0 text-sm">
          {variable.unit}
        </span>
      </div>
    </div>
  );
};
