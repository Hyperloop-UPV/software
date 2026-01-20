import { useStore } from "../../store/store";
import { ChartsGrid } from "./Charts/ChartsGrid";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { TestingToolbar } from "./Toolbar";

interface MainPanelProps {
  activeChartId: string | null;
  columns: number;
  onColumnsChange: (columns: number) => void;
  showSidebarButton: boolean;
  onOpenSidebar: () => void;
}

export const MainPanel = ({
  activeChartId,
  columns,
  onColumnsChange,
  showSidebarButton,
  onOpenSidebar,
}: MainPanelProps) => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const charts = useStore((s) => s.getActiveWorkspaceCharts());
  const addChart = useStore((s) => s.addChart);

  const handleAddChart = () => {
    if (activeWorkspace?.id) {
      addChart(activeWorkspace.id);
    }
  };

  return (
    <div className="relative flex h-full flex-col items-center overflow-y-auto">
      <TestingToolbar
        columns={columns}
        onColumnsChange={onColumnsChange}
        showSidebarButton={showSidebarButton}
        onOpenSidebar={onOpenSidebar}
      />

      {charts.length > 0 ? (
        <ChartsGrid
          charts={charts}
          columns={columns}
          activeChartId={activeChartId}
        />
      ) : (
        <EmptyWorkspace onAddChart={handleAddChart} />
      )}
    </div>
  );
};
