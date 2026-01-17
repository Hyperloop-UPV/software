import { Badge } from "@workspace/ui";
import { Check, X } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useCallback } from "react";
import { useStore } from "../../../../../store/store";

interface TelemetryValueProps {
  units?: string;
  showAverage?: boolean;
  packetId: number;
  variableId: string;
}

export const TelemetryValue = ({
  units,
  showAverage = true,
  packetId,
  variableId,
}: TelemetryValueProps) => {
  const value = useStore(
    (s) => s.telemetry[packetId]?.measurementUpdates[variableId],
  );

  const renderValueContent = useCallback(() => {
    // Numeric with average
    if (typeof value === "object" && value !== null && "average" in value) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-mono text-sm font-bold tabular-nums">
                {value.last.toFixed(2)}
              </span>
            </div>
            {showAverage && (
              <span className="text-muted-foreground text-xs leading-none opacity-60">
                avg {value.average.toFixed(2)}
              </span>
            )}
          </div>
          {units && (
            <span className="text-muted-foreground text-[11px] font-medium">
              {units}
            </span>
          )}
        </div>
      );
    }

    // Boolean
    if (typeof value === "boolean") {
      return (
        <Badge
          variant={value ? "default" : "destructive"}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 font-semibold",
            value
              ? "bg-green-500/15 text-green-600"
              : "bg-red-500/15 text-red-600",
          )}
        >
          {value ? (
            <>
              <Check className="h-3 w-3" />
              <span className="text-xs">True</span>
            </>
          ) : (
            <>
              <X className="h-3 w-3" />
              <span className="text-xs">False</span>
            </>
          )}
        </Badge>
      );
    }

    // String/Enum or regular number
    if (value !== undefined) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
            {typeof value === "number" ? value.toFixed(2) : String(value)}
          </span>
          {units && (
            <span className="text-muted-foreground text-[11px] font-medium">
              {units}
            </span>
          )}
        </div>
      );
    }

    // No value
    return <span className="text-muted-foreground font-mono text-sm">—</span>;
  }, [value, showAverage, units]);

  return (
    <div className="flex shrink-0 items-center">{renderValueContent()}</div>
  );
};
