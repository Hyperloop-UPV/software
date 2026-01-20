import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@workspace/ui";
import { cn } from "@workspace/ui/lib";
import { useShallow } from "zustand/shallow";
import { getTypeBadgeClass } from "../../../../../lib/utils";
import { useStore } from "../../../../../store/store";
import type { Variable } from "../../../../../types/data/telemetryCatalogItem";
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

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `draggable-${packetId}-${variable.id}`,
      data: {
        type: "variable",
        packetId,
        variable: variable.name,
      },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "hover:bg-accent/30 group flex cursor-grab items-center justify-between gap-3 border-t py-2 pl-6 pr-3 active:cursor-grabbing",
        isDragging
          ? "scale-[0.98] border-dashed opacity-20 grayscale"
          : "opacity-100",
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
      <TelemetryValue
        units={variable.units}
        packetId={packetId}
        variableId={variable.id}
      />
    </div>
  );
};
