import { cn } from "@workspace/ui/lib";
import type { WorkspaceChartConfig } from "../../../store/slices/workspacesSlice";

interface ChartsGridProps {
  charts: WorkspaceChartConfig[];
  columns: number;
  activeChartId: string | null;
}

import { DragOverlay } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableChart } from "./SortableChart";
import { TelemetryChart } from "./TelemetryChart";

export const ChartsGrid = ({
  charts,
  columns,
  activeChartId,
}: ChartsGridProps) => {
  const activeChart = charts.find((c) => c.id === activeChartId);

  return (
    <>
      <SortableContext
        items={charts.map((c) => c.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className={cn(
            "grid w-full gap-4 p-4",
            columns === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {charts.map((chart) => (
            <SortableChart key={chart.id} id={chart.id} series={chart.series} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeChart ? (
          <div className="rotate-1 scale-105 shadow-2xl brightness-110 transition-transform duration-200">
            <TelemetryChart
              id={activeChart.id}
              series={activeChart.series}
              isDragging={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </>
  );
};
