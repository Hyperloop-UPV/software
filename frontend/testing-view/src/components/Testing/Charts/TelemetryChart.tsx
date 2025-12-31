import { Trash2 } from "@workspace/ui/icons";
import { useState } from "react";
import "uplot/dist/uPlot.min.css";
import { useStore } from "../../../store/store";
import { ChartLegend } from "./ChartLegend";
import { ChartSurface } from "./ChartSurface";
import { type MeasurementPoint } from "./types";

export const TelemetryChart = ({
  id,
  points,
}: {
  id: string;
  points: MeasurementPoint[];
}) => {
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

  return (
    <div className="border-border bg-card hover:border-accent group relative h-full w-full rounded-xl border p-4 shadow-sm transition-all">
      {/* Delete Button */}
      <button
        onClick={() => activeWorkspaceId && removeChart(activeWorkspaceId, id)}
        className="text-muted-foreground hover:text-destructive absolute right-4 top-4 z-10 p-1 opacity-0 transition-all group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <ChartLegend
        points={points}
        disabledIndices={disabledIndices}
        onToggle={toggleSeries}
        onRemove={(v, i) => handleRemoveSeries(v, i)}
      />

      <ChartSurface points={points} disabledIndices={disabledIndices} />
    </div>
  );
};
