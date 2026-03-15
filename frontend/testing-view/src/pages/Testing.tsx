import { DndContext } from "@dnd-kit/core";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { SquareLibrary } from "@workspace/ui/icons";
import { FilterController } from "../features/filtering/components/FilterController";
import { useGlobalKeyBindings } from "../features/keyBindings/hooks/useGlobalKeyBindings";
import { DndOverlay } from "../features/workspace/components/DndOverlay";
import { MainPanel } from "../features/workspace/components/MainPanel";
import { RightSidebar } from "../features/workspace/components/rightSidebar/RightSidebar";
import { useDnd } from "../features/workspace/hooks/useDnd";
import { useStore } from "../store/store";

export const Testing = () => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const columns = useStore((s) => s.testingPage.columns);
  const setColumns = useStore((s) => s.setTestingColumns);
  const isSidebarVisible = useStore((s) => s.testingPage.isSidebarVisible);
  const setIsSidebarVisible = useStore((s) => s.setTestingSidebarVisible);
  const charts = useStore((s) => s.getActiveWorkspaceCharts());

  const isCommandsVisible = useStore((s) => s.isCommandsVisible);
  const isMessagesVisible = useStore((s) => s.isMessagesVisible);
  const isHorizontal = useStore((s) => s.isHorizontal);
  const isTelemetryVisible = useStore((s) => s.isTelemetryVisible);

  const showCommandsMessages = isCommandsVisible || isMessagesVisible;

  useGlobalKeyBindings();

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
            <p className="text-muted-foreground max-w-125 mt-2">
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
          <ResizablePanelGroup
            orientation="horizontal"
            className="h-full w-full"
          >
            <ResizablePanel
              id="main"
              defaultSize={
                isSidebarVisible
                  ? isHorizontal && showCommandsMessages && isTelemetryVisible
                    ? "40%"
                    : showCommandsMessages
                      ? "55%"
                      : "70%"
                  : "100%"
              }
              minSize="30%"
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
                <ResizablePanel
                  id="sidebar"
                  defaultSize={
                    isHorizontal && showCommandsMessages && isTelemetryVisible
                      ? "60%"
                      : showCommandsMessages
                        ? "45%"
                        : "30%"
                  }
                  minSize="20%"
                  maxSize="70%"
                >
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
