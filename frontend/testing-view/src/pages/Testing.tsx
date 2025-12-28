import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  Button,
  Skeleton,
} from "@workspace/ui";
import { useState } from "react";
import { RightSidebar } from "../components/RightSidebar/RightSidebar";
import { useStore } from "../store/store";
import { WorkspaceFilterController } from "../components/Filters/FilterController";
import { ChevronLeft, Plus } from "@workspace/ui/icons";
import { TelemetryChart } from "../components/Charts/TelemetryChart";
import { cn } from "@workspace/ui/lib";

export const Testing = () => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [chartColumns, setChartColumns] = useState(1);
  const [isChangingColumns, setIsChangingColumns] = useState(false);

  const charts = useStore((s) => s.getActiveWorkspaceCharts());
  const addChart = useStore((s) => s.addChart);

  if (!activeWorkspace) {
    return <p>No active tab</p>;
  }

  const handleChartColumnsChange = (columns: number) => {
    setIsChangingColumns(true);
    setChartColumns(columns);
    setTimeout(() => {
      setIsChangingColumns(false);
    }, 50);
  };

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
              <div className="bg-background p-sm sticky top-0 z-10 flex w-full justify-end gap-2">
                <Button
                  onClick={() =>
                    activeWorkspace.id && addChart(activeWorkspace.id)
                  }
                  variant="outline"
                  size="sm"
                  className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Chart
                </Button>
                <Button
                  onClick={() => handleChartColumnsChange(1)}
                  variant={chartColumns === 1 ? "default" : "outline"}
                  size="icon-sm"
                >
                  1
                </Button>
                <Button
                  onClick={() => handleChartColumnsChange(2)}
                  variant={chartColumns === 2 ? "default" : "outline"}
                  size="icon-sm"
                >
                  2
                </Button>
                {!isSidebarVisible && (
                  <Button
                    onClick={() => setIsSidebarVisible(true)}
                    className="text-foreground"
                    variant="outline"
                    size="icon"
                  >
                    <span className="text-lg">
                      <ChevronLeft className="text-foreground h-4 w-4" />
                    </span>
                  </Button>
                )}
              </div>
              <div
                className={cn(
                  "px-lg py-sm grid w-full auto-rows-fr gap-4",
                  chartColumns === 1 ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                {isChangingColumns
                  ? Array.from({ length: charts.length }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-full min-h-[350px] w-full"
                      />
                    ))
                  : charts.map((chart) => (
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
