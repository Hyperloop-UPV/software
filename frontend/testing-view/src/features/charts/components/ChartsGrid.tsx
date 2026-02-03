import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@workspace/ui/lib";
import type { WorkspaceChartConfig } from "../types/charts";
import { SortableChart } from "./SortableChart";

interface ChartsGridProps {
  charts: WorkspaceChartConfig[];
  columns: number;
}

export const ChartsGrid = ({ charts, columns }: ChartsGridProps) => {
  return (
    <SortableContext
      items={charts.map((c) => c.id)}
      strategy={rectSortingStrategy}
    >
      <div
        className={cn(
          "grid w-full gap-4 p-4",
          "grid-auto-rows-[1fr]",
          columns === 1 ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        {charts.map((chart) => (
          <SortableChart key={chart.id} id={chart.id} series={chart.series} />
        ))}
      </div>
    </SortableContext>
  );
};
