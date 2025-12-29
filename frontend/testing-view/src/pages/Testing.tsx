import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { LayoutGrid, Plus } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { TelemetryChart } from "../components/Charts/TelemetryChart";
import { WorkspaceFilterController } from "../components/Filters/FilterController";
import { RightSidebar } from "../components/RightSidebar/RightSidebar";
import { TestingToolbar } from "../components/Testing/Toolbar";
import { useStore } from "../store/store";

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
                showSidebarButton={!isSidebarVisible}
                onOpenSidebar={() => setIsSidebarVisible(true)}
              />
              {charts.length > 0 ? (
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
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-5 text-center">
                  {/* Large visual cue */}
                  <div className="bg-muted/30 ring-border flex h-24 w-24 items-center justify-center rounded-3xl shadow-sm ring-1">
                    <LayoutGrid className="text-muted-foreground/30 h-12 w-12" />
                  </div>

                  {/* Typography */}
                  <div className="space-y-2 px-6">
                    <h3 className="text-foreground text-2xl font-semibold tracking-tight">
                      Empty Workspace
                    </h3>
                    <p className="text-muted-foreground max-w-[320px] text-sm leading-relaxed">
                      Visualize real-time telemetry by adding your first chart
                      or selecting variables from the sidebar.
                    </p>
                  </div>

                  {/* Add chart button */}
                  <Button
                    onClick={() =>
                      activeWorkspace.id && addChart(activeWorkspace.id)
                    }
                    variant="secondary"
                    className="ring-border/50 hover:ring-primary/30 gap-2 px-6 shadow-sm ring-1 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    Add your first chart
                  </Button>
                </div>
              )}
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
