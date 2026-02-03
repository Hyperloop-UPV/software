import { useDroppable } from "@dnd-kit/core";
import { cn } from "@workspace/ui/lib";
import { useStore } from "../../../store/store";
import type { DndActiveData } from "../../../types/app/dndData";
import { ChartsGrid } from "../../charts/components/ChartsGrid";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { TestingToolbar } from "./Toolbar";

interface MainPanelProps {
  columns: number;
  onColumnsChange: (columns: number) => void;
  showSidebarButton: boolean;
  onOpenSidebar: () => void;
  activeDragData: DndActiveData | null;
}

export const MainPanel = ({
  columns,
  onColumnsChange,
  showSidebarButton,
  onOpenSidebar,
  activeDragData,
}: MainPanelProps) => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const charts = useStore((s) => s.getActiveWorkspaceCharts());
  const addChart = useStore((s) => s.addChart);

  const handleAddChart = () => {
    if (activeWorkspace?.id) {
      addChart(activeWorkspace.id);
    }
  };

  const { setNodeRef, isOver } = useDroppable({
    id: "main-panel-droppable",
  });

  const isVariableOver = isOver && activeDragData?.type === "variable";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex h-full flex-col items-center overflow-y-auto",
        isVariableOver ? "border-primary/20 bg-primary/5" : "",
      )}
    >
      <TestingToolbar
        columns={columns}
        onColumnsChange={onColumnsChange}
        showSidebarButton={showSidebarButton}
        onOpenSidebar={onOpenSidebar}
      />

      {charts.length > 0 ? (
        <ChartsGrid charts={charts} columns={columns} />
      ) : (
        <EmptyWorkspace onAddChart={handleAddChart} />
      )}
    </div>
  );
};
