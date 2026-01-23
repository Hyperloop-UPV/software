import { DragOverlay } from "@dnd-kit/core";
import { Badge } from "@workspace/ui";
import type { WorkspaceChartConfig } from "../../store/slices/workspacesSlice";
import type { DndActiveData } from "../../types/app/dndData";
import { TelemetryChart } from "./Charts/TelemetryChart";

interface DndOverlayProps {
  activeDragData: DndActiveData | null;
  charts: WorkspaceChartConfig[];
}

export const DndOverlay = ({ activeDragData, charts }: DndOverlayProps) => {
  if (!activeDragData) return null;

  return (
    <DragOverlay dropAnimation={{ duration: 200 }}>
      {activeDragData.type === "variable" ? (
        // Variable Ghost
        <div className="bg-primary flex max-w-[200px] rotate-3 scale-110 items-center gap-2 rounded-lg px-3 py-2 text-white opacity-90 shadow-2xl">
          <Badge className="bg-white/20">{activeDragData.variableType}</Badge>
          <span className="text-xs font-bold">
            {activeDragData.variableName}
          </span>
        </div>
      ) : (
        // Chart Ghost
        <div className="w-full rotate-2 scale-105 cursor-grabbing shadow-2xl brightness-110">
          <TelemetryChart
            id={activeDragData.chartId}
            series={
              charts.find((c) => c.id === activeDragData.chartId)?.series || []
            }
            isDragging={true}
          />
        </div>
      )}
    </DragOverlay>
  );
};
