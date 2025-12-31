import { cn } from "@workspace/ui/lib";
import type { WorkspaceChartConfig } from "../../../store/slices/workspacesSlice";
import { TelemetryChart } from "./TelemetryChart";

interface ChartsGridProps {
  charts: WorkspaceChartConfig[];
  columns: number;
}

export const ChartsGrid = ({ charts, columns }: ChartsGridProps) => {
  return (
    <div
      className={cn(
        "px-lg py-sm grid w-full auto-rows-fr gap-4",
        columns === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {charts.map((chart) => (
        <TelemetryChart key={chart.id} id={chart.id} series={chart.series} />
      ))}
    </div>
  );
};
