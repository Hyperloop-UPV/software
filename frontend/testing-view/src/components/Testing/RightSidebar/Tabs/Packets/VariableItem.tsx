import { Badge } from "@workspace/ui";
import { cn } from "@workspace/ui/lib";
import { getTypeBadgeClass } from "../../../../../lib/utils";
import { useStore } from "../../../../../store/store";
import type { Variable } from "../../../../../types/data/packet";
import ChartPicker from "./ChartPicker";
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
  isFirst?: boolean;
}

export const VariableItem = ({
  packetId,
  variable,
  liveValue,
  isFirst = false,
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

  const hasValue = liveValue !== undefined;

  return (
    <div
      className={cn(
        "hover:bg-accent/30 group flex items-center justify-between gap-3 border-t py-2 pl-6 pr-3 transition-all",
        isFirst && "border-t-0",
        hasValue && "bg-accent/5",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* Type Badge */}
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 rounded px-1.5 py-1 text-[10px] font-bold uppercase leading-none",
            getTypeBadgeClass(variable.type),
          )}
        >
          {variable.type}
        </Badge>

        {/* Variable Name */}
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground truncate text-xs font-semibold leading-tight">
            {variable.name}
          </span>

          <span className="text-muted-foreground truncate text-xs leading-tight">
            {variable.id}
          </span>
        </div>

        {/* Chart Picker */}
        {variable.type !== "enum" && (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <ChartPicker
              charts={charts}
              onAdd={handleAddToChart}
              onCreate={handleCreateChart}
            />
          </div>
        )}
      </div>

      {/* Live Value */}
      <TelemetryValue value={liveValue} units={variable.units} />
    </div>
  );
};
