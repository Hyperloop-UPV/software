import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TelemetryChart } from "./TelemetryChart";
export function SortableChart({ id, series }: { id: string; series: any[] }) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({
    id,
    data: { chartId: id },
  });

  const isVariableOver = isOver && active?.data.current?.type === "variable";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative h-full w-full">
      <TelemetryChart
        id={id}
        series={series}
        isDragging={false}
        isOver={isVariableOver}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}
