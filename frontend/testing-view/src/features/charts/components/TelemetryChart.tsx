import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical, Trash2 } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";
import { useState } from "react";
import "uplot/dist/uPlot.min.css";
import { useStore } from "../../../store/store";
import type { WorkspaceChartSeries } from "../types/charts";
import { ChartLegend } from "./ChartLegend";
import { ChartSurface } from "./ChartSurface";

interface TelemetryChartProps {
  id: string;
  series: WorkspaceChartSeries[];
  isDragging: boolean;
  isOver?: boolean;
  isIncompatibleDrop?: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
}

/**
 * A draggable, interactive chart container for visualizing telemetry data.
 *
 * Features:
 * - Data Visualization: Renders high-frequency data using `uPlot` via `ChartSurface`.
 * - Displays a `ChartLegend` to toggle or remove individual data series.
 * - Supports drag-and-drop reordering within the grid.
 *
 * It manages local state for "disabled series" (toggled off in legend but still in config),
 * preventing data loss when users just want to temporarily hide a line.
 */
export const TelemetryChart = ({
  id,
  series,
  isDragging,
  isOver,
  isIncompatibleDrop,
  dragAttributes,
  dragListeners,
}: TelemetryChartProps) => {
  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId());
  const removeChart = useStore((s) => s.removeChart);
  const removeSeries = useStore((s) => s.removeSeriesFromChart);

  const [disabledVariables, setDisabledVariables] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenValueLabels, setHiddenValueLabels] = useState<Set<string>>(
    new Set(),
  );

  const toggleSeries = (variable: string) => {
    setDisabledVariables((prev) => {
      const next = new Set(prev);
      if (next.has(variable)) next.delete(variable);
      else next.add(variable);
      return next;
    });
  };

  const toggleValueLabel = (variable: string) => {
    setHiddenValueLabels((prev) => {
      const next = new Set(prev);
      if (next.has(variable)) next.delete(variable);
      else next.add(variable);
      return next;
    });
  };

  const handleRemoveSeries = (variable: string) => {
    if (!activeWorkspaceId) return;
    removeSeries(activeWorkspaceId, id, variable);
    setDisabledVariables((prev) => {
      const next = new Set(prev);
      next.delete(variable);
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
      data-testid="chart"
      className={cn(
        "border-border bg-card hover:border-accent group relative h-full w-full rounded-xl border p-4 shadow-sm transition-colors duration-200",
        isOver ? "border-primary/20 bg-primary/5" : "",
        isIncompatibleDrop ? "border-destructive/40 bg-destructive/5" : "",
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
          title="Remove chart"
          onClick={() =>
            activeWorkspaceId && removeChart(activeWorkspaceId, id)
          }
          className="text-muted-foreground hover:text-destructive p-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isIncompatibleDrop && (
        <div className="border-destructive pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-xl border-2 pt-20">
          <span className="text-destructive text-xs font-semibold">
            Cannot mix enum and numeric series
          </span>
        </div>
      )}

      <ChartLegend
        chartId={id}
        series={series}
        disabledVariables={disabledVariables}
        hiddenValueLabels={hiddenValueLabels}
        onToggle={toggleSeries}
        onToggleValueLabel={toggleValueLabel}
        onRemove={handleRemoveSeries}
      />

      <ChartSurface
        chartId={id}
        series={series}
        disabledVariables={disabledVariables}
        hiddenValueLabels={hiddenValueLabels}
      />
    </div>
  );
};
