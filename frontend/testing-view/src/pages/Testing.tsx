import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { useState } from "react";
import { TelemetryChart } from "../components/Testing/Charts/TelemetryChart";
import { FilterController } from "../components/Testing/Filters/FilterController";
import { MainPanel } from "../components/Testing/MainPanel";
import { RightSidebar } from "../components/Testing/RightSidebar/RightSidebar";
import { useStore } from "../store/store";

export const Testing = () => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const columns = useStore((s) => s.testingPage.columns);
  const setColumns = useStore((s) => s.setTestingColumns);
  const isSidebarVisible = useStore((s) => s.testingPage.isSidebarVisible);
  const setIsSidebarVisible = useStore((s) => s.setTestingSidebarVisible);
  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId());
  const charts = useStore((s) => s.getActiveWorkspaceCharts());
  const reorderCharts = useStore((s) => s.reorderCharts);
  const addSeriesToChart = useStore((s) => s.addSeriesToChart);

  if (!activeWorkspace) {
    return <p>No active workspace</p>;
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (!activeWorkspaceId) return null;
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragData(event.active.data.current);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;

    if (!over) return;

    if (active.data.current?.type === "variable") {
      const { packetId, variable } = active.data.current;
      const chartId = over.data.current?.chartId;

      if (chartId && activeWorkspaceId) {
        addSeriesToChart(activeWorkspaceId, chartId, { packetId, variable });
      }
    } else if (
      over &&
      active.id !== over.id &&
      active.data.current?.type !== "variable"
    ) {
      const oldIndex = charts.findIndex((c) => c.id === active.id);
      const newIndex = charts.findIndex((c) => c.id === over.id);
      reorderCharts(activeWorkspaceId, oldIndex, newIndex);
    }
    setActiveDragData(null);
  };

  return (
    <>
      <FilterController />
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative h-full w-full">
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel
              defaultSize={isSidebarVisible ? 60 : 100}
              minSize={30}
            >
              <MainPanel
                columns={columns}
                onColumnsChange={setColumns}
                showSidebarButton={!isSidebarVisible}
                onOpenSidebar={() => setIsSidebarVisible(true)}
                activeChartId={activeChartId}
              />
            </ResizablePanel>

            {isSidebarVisible && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={40} minSize={20} maxSize={70}>
                  <RightSidebar onClose={() => setIsSidebarVisible(false)} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        <DragOverlay>
          {activeDragData?.type === "variable" ? (
            <div className="border-secondary/20 bg-secondary/90 text-secondary-foreground flex rotate-3 scale-110 cursor-grabbing items-center gap-2 rounded-lg border px-3 py-2 shadow-2xl backdrop-blur-sm transition-transform">
              {/* Simplified Badge */}
              <div className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {activeDragData.variableType || "VAR"}
              </div>
              {/* Variable Name */}
              <span className="whitespace-nowrap text-sm font-semibold">
                {activeDragData.variable}
              </span>
            </div>
          ) : activeDragData?.chartId ? (
            // Your existing chart overlay logic
            <TelemetryChart
              id={activeDragData.chartId}
              series={activeDragData.series}
              isDragging={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
};
