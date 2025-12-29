import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  Button,
} from "@workspace/ui";
import { RightSidebar } from "../components/RightSidebar/RightSidebar";
import { useStore } from "../store/store";
import { WorkspaceFilterController } from "../components/Filters/FilterController";
import { ChevronLeft, Plus } from "@workspace/ui/icons";
import { TelemetryChart } from "../components/Charts/TelemetryChart";
import { cn } from "@workspace/ui/lib";
import { TestingToolbar } from "../components/Testing/Toolbar";

export const Testing = () => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const columns = useStore((s) => s.testingPage.columns);
  const setColumns = useStore((s) => s.setTestingColumns);
  const isSidebarVisible = useStore((s) => s.testingPage.isSidebarVisible);
  const setIsSidebarVisible = useStore((s) => s.setTestingSidebarVisible);

  const charts = useStore((s) => s.getActiveWorkspaceCharts());
  const addChart = useStore((s) => s.addChart);

  if (!activeWorkspace) {
    return <p>No active tab</p>;
  }

  return (
    <>
      <WorkspaceFilterController />

      {/* Main Layout */}
      <div className="relative h-full w-full">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel
            defaultSize={isSidebarVisible ? 60 : 100}
            minSize={30}
          >
            <div className="relative flex h-full flex-col items-center overflow-y-auto">
              <TestingToolbar
                columns={columns}
                onColumnsChange={setColumns}
                onAddChart={() =>
                  activeWorkspace.id && addChart(activeWorkspace.id)
                }
                showSidebarButton={!isSidebarVisible}
                onOpenSidebar={() => setIsSidebarVisible(true)}
              />
              <div
                className={cn(
                  "px-lg py-sm grid w-full auto-rows-fr gap-4",
                  columns === 1 ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                {charts.map((chart) => (
                  <TelemetryChart
                    key={chart.id}
                    id={chart.id}
                    points={chart.series}
                  />
                ))}
              </div>
            </div>
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
