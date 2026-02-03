import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { useStore } from "../../../store/store";
import type { DndActiveData } from "../types/dndData";

export function useDnd() {
  const [activeData, setActiveData] = useState<DndActiveData | null>(null);
  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId());
  const charts = useStore((s) => s.getActiveWorkspaceCharts());
  const reorderCharts = useStore((s) => s.reorderCharts);
  const addSeries = useStore((s) => s.addSeriesToChart);
  const addChart = useStore((s) => s.addChart);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveData(event.active.data.current as DndActiveData);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveData(null);

    if (!over || !activeWorkspaceId) return;

    // Logic for adding a variable to a chart
    if (active.data.current?.type === "variable") {
      const chartId = over.data.current?.chartId;
      const { packetId, variableId } = active.data.current;
      // Add a variable to an existing chart
      if (chartId) {
        addSeries(activeWorkspaceId, chartId, {
          packetId,
          variable: variableId,
        });
        // Add a new chart to the main panel
      } else if (over.id === "main-panel-droppable") {
        const newChartId = addChart(activeWorkspaceId);
        addSeries(activeWorkspaceId, newChartId, {
          packetId,
          variable: variableId,
        });
      }
    }
    // Logic for reordering charts
    else if (
      active.data.current?.type !== "variable" &&
      active.id !== over.id
    ) {
      const oldIndex = charts.findIndex((c) => c.id === active.id);
      const newIndex = charts.findIndex((c) => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1)
        reorderCharts(activeWorkspaceId, oldIndex, newIndex);
    }
  };

  return {
    sensors,
    activeData,
    handleDragStart,
    handleDragEnd,
  };
}
