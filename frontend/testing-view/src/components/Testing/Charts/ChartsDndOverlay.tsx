import { DragOverlay } from "@dnd-kit/core";
import { Badge } from "@workspace/ui";
import { TelemetryChart } from "./TelemetryChart";

export const ChartsDndOverlay = ({
  activeData,
  charts,
}: {
  activeData: any;
  charts: any[];
}) => {
  if (!activeData) return null;

  return (
    <DragOverlay dropAnimation={{ duration: 200 }}>
      {activeData.type === "variable" ? (
        // Variable Ghost
        <div className="bg-primary flex rotate-3 scale-110 items-center gap-2 rounded-lg px-3 py-2 text-white opacity-90 shadow-2xl">
          <Badge className="bg-white/20">{activeData.variableType}</Badge>
          <span className="text-xs font-bold">{activeData.variableName}</span>
        </div>
      ) : (
        // Chart Ghost
        <div className="w-full rotate-2 scale-105 cursor-grabbing shadow-2xl brightness-110">
          <TelemetryChart
            id={activeData.chartId}
            series={
              charts.find((c) => c.id === activeData.chartId)?.series || []
            }
            isDragging={true}
          />
        </div>
      )}
    </DragOverlay>
  );
};
