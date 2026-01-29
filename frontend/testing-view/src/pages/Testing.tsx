import { DndContext } from "@dnd-kit/core";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { SquareLibrary } from "@workspace/ui/icons";
import { DndOverlay } from "../components/Testing/DndOverlay";
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

  const {
    sensors,
    activeData: activeDragData,
    handleDragStart,
    handleDragEnd,
  } = useDnd();

  if (!activeWorkspace) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <SquareLibrary className="text-muted-foreground h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">No Active Workspace</h2>
            <p className="text-muted-foreground mt-2 max-w-[500px]">
              Create your first workspace to start organizing your commands,
              telemetry, and charts.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                activeDragData={activeDragData}
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
        <DndOverlay activeDragData={activeDragData} charts={charts} />
      </DndContext>
    </>
  );
};
