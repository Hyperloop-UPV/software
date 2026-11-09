// Drag-and-drop wiring for dragging measurement rows from the left Series
// sidebar (SeriesGroup.tsx) onto a plot card (PlotWrapper.tsx) to assign
// them. Mirrors the equivalent pattern already established in the sibling
// testing-view workspace (features/workspace/hooks/useDnd.ts) — a signal's
// dragged id(s) travel via dnd-kit's `data`, not native DataTransfer, since
// the drag source (under AppSidebar) and drop targets (under PlotStudio) are
// unrelated component subtrees.
import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { useStore } from "../../../store/store";
import { useAssignSignalsToPlot } from "./useStudioSignals";

export function useSignalDnd() {
  const [activeIds, setActiveIds] = useState<string[] | null>(null);
  const assignSignalsToPlot = useAssignSignalsToPlot();
  const assignNormalSignalsToPlot = useStore(
    (state) => state.assignNormalSignalsToPlot,
  );

  // Small movement threshold — lets a plain click on a row still reach its
  // onClick/checkbox toggle; only a deliberate drag activates dnd-kit.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ids = event.active.data.current?.ids as string[] | undefined;
    setActiveIds(ids ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIds(null);

    const ids = active.data.current?.ids as string[] | undefined;
    if (!ids || !over) return;
    if (over.data.current?.kind === "normal-plot") {
      const plotId = over.data.current.plotId as string | undefined;
      if (plotId) assignNormalSignalsToPlot(plotId, ids);
      return;
    }
    void assignSignalsToPlot(String(over.id), ids);
  };

  return { sensors, activeIds, handleDragStart, handleDragEnd };
}
