import { GripVertical, Trash2 } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";
import { useState } from "react";
import "uplot/dist/uPlot.min.css";
import { useStore } from "../../../store/store";
import type { VariableSeries } from "../../../types/workspace/charts";
import { ChartLegend } from "./ChartLegend";
import { ChartSurface } from "./ChartSurface";

interface TelemetryChartProps {
  id: string;
  series: VariableSeries[];
  isDragging: boolean;
  isOver?: boolean;
  dragAttributes?: any;
  dragListeners?: any;
}

export const TelemetryChart = ({
  id,
  series,
  isDragging,
  isOver,
  dragAttributes,
  dragListeners,
}: TelemetryChartProps) => {
  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId());
  const removeChart = useStore((s) => s.removeChart);
  const removeSeries = useStore((s) => s.removeSeriesFromChart);

  const [disabledIndices, setDisabledIndices] = useState<Set<number>>(
    new Set(),
  );

  const toggleSeries = (index: number) => {
    setDisabledIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleRemoveSeries = (variable: string, index: number) => {
    if (!activeWorkspaceId) return;
    removeSeries(activeWorkspaceId, id, variable);
    setDisabledIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  if (isDragging) {
    return (
      <div className="h-full w-full">
        <div className="bg-muted-foreground/10 border-muted-foreground/20 h-full min-h-[300px] w-full rounded-xl border-2 border-dashed"></div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border bg-card hover:border-accent group relative h-full w-full rounded-xl border p-4 shadow-sm transition-colors duration-200",
        isOver ? "border-primary/20 bg-primary/5" : "",
      )}
    >
      <div className="z-5 absolute right-4 top-4 flex items-center gap-2 group-hover:opacity-100">
        {/* Drag Handle */}
        <button
          {...dragAttributes}
          {...dragListeners}
          className="text-muted-foreground/80 hover:text-muted-foreground cursor-grab p-1 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Delete Button */}
        <button
          onClick={() =>
            activeWorkspaceId && removeChart(activeWorkspaceId, id)
          }
          className="text-muted-foreground hover:text-destructive p-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ChartLegend
        chartId={id}
        series={series}
        disabledIndices={disabledIndices}
        onToggle={toggleSeries}
        onRemove={(v, i) => handleRemoveSeries(v, i)}
      />

      <ChartSurface
        chartId={id}
        series={series}
        disabledIndices={disabledIndices}
      />
    </div>
  );
};
