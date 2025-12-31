import { Button } from "@workspace/ui";
import { ChevronLeft, Plus } from "@workspace/ui/icons";
import { useStore } from "../../store/store";

interface TestingToolbarProps {
  columns: number;
  onColumnsChange: (cols: number) => void;
  showSidebarButton: boolean;
  onOpenSidebar: () => void;
}

export const TestingToolbar = ({
  columns,
  onColumnsChange,
  showSidebarButton,
  onOpenSidebar,
}: TestingToolbarProps) => {
  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId());
  const addChart = useStore((s) => s.addChart);
  const charts = useStore((s) => s.getActiveWorkspaceCharts());

  const handleAddChart = () => {
    if (!activeWorkspaceId) return;
    addChart(activeWorkspaceId);
  };

  return (
    <div className="backdrop-blur-xs sticky top-0 z-10 flex w-full justify-end gap-2 p-2">
      <Button
        onClick={handleAddChart}
        variant="secondary"
        size="sm"
        className="ring-border/50 hover:ring-primary/30 gap-2 px-6 shadow-sm ring-1 transition-all"
      >
        <Plus className="h-4 w-4" /> Add Chart
      </Button>
      <Button
        onClick={() => onColumnsChange(1)}
        className="ring-border/50 hover:ring-primary/30 shadow-sm ring-1 transition-all"
        variant={columns === 1 ? "default" : "secondary"}
        disabled={charts.length === 0}
        size="icon-sm"
      >
        1
      </Button>
      <Button
        onClick={() => onColumnsChange(2)}
        className="ring-border/50 hover:ring-primary/30 shadow-sm ring-1 transition-all"
        variant={columns === 2 ? "default" : "secondary"}
        disabled={charts.length === 0}
        size="icon-sm"
      >
        2
      </Button>
      {showSidebarButton && (
        <Button
          onClick={onOpenSidebar}
          className="ring-border/50 hover:ring-primary/30 shadow-sm ring-1 transition-all"
          variant="secondary"
          size="icon-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
