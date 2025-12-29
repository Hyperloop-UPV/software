import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@workspace/ui";
import type { Variable } from "../../../../types/Packet";
import { getTypeBadgeClass } from "../../../../lib/utils";
import { cn } from "@workspace/ui/lib";
import { Check, Plus, X } from "@workspace/ui/icons";
import { useStore } from "../../../../store/store";
import ChartSeriesPicker from "./ChartSeriesPicker";
import { TelemetryValue } from "./TelemetryValue";

interface VariableItemProps {
  packetId: number;
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

export const VariableItem = ({
  packetId,
  variable,
  liveValue,
}: VariableItemProps) => {
  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId());
  const charts = useStore((s) => s.getActiveWorkspaceCharts());
  const addSeries = useStore((s) => s.addSeriesToChart);
  const addChart = useStore((s) => s.addChart);

  const handleAddToChart = (chartId: string) => {
    if (!activeWorkspaceId) return;
    addSeries(activeWorkspaceId, chartId, {
      packetId,
      variable: variable.id,
    });
  };

  const handleCreateChart = () => {
    if (!activeWorkspaceId) return;

    const newChartId = addChart(activeWorkspaceId);
    handleAddToChart(newChartId);
  };

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
    <div className="hover:bg-accent/10 group flex items-center justify-between gap-2.5 border-t py-1.5 pl-6 pr-3 transition-colors first:border-t-0">
      <div className="flex min-w-0 items-center gap-2">
        {/* Variable Type: float, integer, enum, boolean */}
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase",
            getTypeBadgeClass(variable.type),
          )}
        >
          {variable.type}
        </Badge>

        {/* Variable Name */}
        <span className="text-muted-foreground truncate text-xs font-medium">
          {variable.name}
        </span>

        {/* Add to Chart Dropdown: show for all except enum */}
        {variable.type !== "enum" && (
          <ChartSeriesPicker
            charts={charts}
            onAdd={handleAddToChart}
            onCreate={handleCreateChart}
          />
        )}
      </div>

      <TelemetryValue value={liveValue} units={variable.units} />
    </div>
  );
};
