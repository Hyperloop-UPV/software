import { DndContext } from "@dnd-kit/core";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { ChartsDndOverlay } from "../components/Testing/Charts/ChartsDndOverlay";
import { FilterController } from "../components/Testing/Filters/FilterController";
import { MainPanel } from "../components/Testing/MainPanel";
import { RightSidebar } from "../components/Testing/RightSidebar/RightSidebar";
import { useDnd } from "../hooks/useDnd";
import { useStore } from "../store/store";

export const Testing = () => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const columns = useStore((s) => s.testingPage.columns);
  const setColumns = useStore((s) => s.setTestingColumns);
  const isSidebarVisible = useStore((s) => s.testingPage.isSidebarVisible);
  const setIsSidebarVisible = useStore((s) => s.setTestingSidebarVisible);
  const charts = useStore((s) => s.getActiveWorkspaceCharts());

  if (!activeWorkspace) {
    return <p>No active workspace</p>;
  }

  const { sensors, activeData, handleDragStart, handleDragEnd } = useDnd();

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

        {/* Dnd Overlay */}
        <ChartsDndOverlay activeData={activeData} charts={charts} />
      </DndContext>
    </>
  );
};
