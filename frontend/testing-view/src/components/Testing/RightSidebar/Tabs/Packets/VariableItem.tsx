import { Badge } from "@workspace/ui";
import { cn } from "@workspace/ui/lib";
import { useShallow } from "zustand/shallow";
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
}

export const VariableItem = ({ packetId, variable }: VariableItemProps) => {
  const { activeWorkspaceId, charts, addSeries, addChart } = useStore(
    useShallow((s) => ({
      activeWorkspaceId: s.getActiveWorkspaceId(),
      charts: s.getActiveWorkspaceCharts(),
      addSeries: s.addSeriesToChart,
      addChart: s.addChart,
    })),
  );

  const liveValue = useStore(
    (s) => s.telemetry[packetId]?.measurementUpdates[variable.id],
  );

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
        "hover:bg-accent/30 group flex items-center justify-between gap-3 border-t py-2 pl-6 pr-3",
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
