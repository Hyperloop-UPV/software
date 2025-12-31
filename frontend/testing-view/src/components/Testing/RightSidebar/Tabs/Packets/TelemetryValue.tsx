import { Badge } from "@workspace/ui";
import { Check, X } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";

interface TelemetryValueProps {
  value: any;
  units?: string;
  showAverage?: boolean;
}
export const TelemetryValue = ({
  value,
  units,
  showAverage = true,
}: TelemetryValueProps) => {
  // 1. Determine the value display
  const renderValueContent = () => {
    if (typeof value === "object" && value !== null && "average" in value) {
      return (
        <div className="flex flex-col items-end leading-tight">
          <span className="text-primary font-mono text-sm font-bold">
            {value.last.toFixed(2)}
          </span>
          {showAverage && (
            <span className="text-muted-foreground text-[10px] opacity-70">
              avg: {value.average.toFixed(2)}
            </span>
          )}
        </div>
      );
    }

    if (typeof value === "boolean") {
      return value ? (
        <Badge variant="default" className="bg-green-500/20 p-1 text-green-500">
          <Check className="h-3 w-3" />
        </Badge>
      ) : (
        <Badge variant="destructive" className="bg-red-500/20 p-1 text-red-500">
          <X className="h-3 w-3" />
        </Badge>
      );
    }

    return (
      <span
        className={cn(
          "font-mono text-xs font-semibold",
          value === undefined ? "text-muted-foreground" : "text-primary",
        )}
      >
        {value === undefined
          ? "---"
          : typeof value === "number"
            ? value.toFixed(2)
            : String(value)}
      </span>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {renderValueContent()}
      {units && (
        <span className="text-muted-foreground shrink-0 text-right text-xs">
          {units}
        </span>
      )}
    </div>
  );
};
