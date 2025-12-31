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

  return (
    <div className="hover:bg-accent/10 group flex items-center justify-between gap-2.5 border-t py-1.5 pl-6 pr-3 transition-colors first:border-t-0">
      <div className="flex min-w-0 items-center gap-2">
        {/* Variable Type: float, integer, enum, boolean */}
        <Badge
          variant="secondary"
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
          <ChartPicker
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
