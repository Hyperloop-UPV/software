import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { WorkspaceFilterController } from "../components/Testing/Filters/FilterController";
import { MainPanel } from "../components/Testing/MainPanel";
import { RightSidebar } from "../components/Testing/RightSidebar/RightSidebar";
import { useStore } from "../store/store";

export const Testing = () => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const columns = useStore((s) => s.testingPage.columns);
  const setColumns = useStore((s) => s.setTestingColumns);
  const isSidebarVisible = useStore((s) => s.testingPage.isSidebarVisible);
  const setIsSidebarVisible = useStore((s) => s.setTestingSidebarVisible);

  if (!activeWorkspace) {
    return <p>No active workspace</p>;
  }

  return (
    <>
      <WorkspaceFilterController />

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
    </>
  );
};
