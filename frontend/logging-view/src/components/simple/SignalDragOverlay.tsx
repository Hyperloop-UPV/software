// Ghost shown while dragging measurement row(s) from the Series sidebar onto
// a plot — a real React-rendered badge (via dnd-kit's DragOverlay) instead of
// the native browser drag-image snapshot, so dragging a multi-selection
// visibly reads as "N series" moving together, not just one row.
import { DragOverlay } from "@dnd-kit/core";
import { getSignalName } from "../../lib/plotStudio/units";
import { useStore } from "../../store/store";

interface SignalDragOverlayProps {
  activeIds: string[] | null;
}

export default function SignalDragOverlay({ activeIds }: SignalDragOverlayProps) {
  const adjData = useStore((s) => s.adjData);

  if (!activeIds || activeIds.length === 0) return null;

  const label = activeIds.length === 1
    ? (getSignalName(adjData, activeIds[0]) ?? activeIds[0])
    : `${activeIds.length} measurements`;

  return (
    <DragOverlay dropAnimation={{ duration: 200 }}>
      <div className="bg-primary flex max-w-[200px] rotate-3 scale-110 items-center gap-1.5 rounded-lg px-3 py-2 text-white opacity-90 shadow-2xl">
        <span className="truncate text-xs font-bold">{label}</span>
      </div>
    </DragOverlay>
  );
}
