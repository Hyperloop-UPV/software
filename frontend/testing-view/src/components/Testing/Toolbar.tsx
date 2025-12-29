import { Button } from "@workspace/ui";
import { Plus, ChevronLeft } from "@workspace/ui/icons";

interface TestingToolbarProps {
  columns: number;
  onColumnsChange: (cols: number) => void;
  onAddChart: () => void;
  showSidebarButton: boolean;
  onOpenSidebar: () => void;
}

export const TestingToolbar = ({
  columns,
  onColumnsChange,
  onAddChart,
  showSidebarButton,
  onOpenSidebar,
}: TestingToolbarProps) => (
  <div className="sticky top-0 z-10 flex w-full justify-end gap-2 p-2 backdrop-blur-sm">
    <Button
      onClick={onAddChart}
      variant="outline"
      size="sm"
      className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
    >
      <Plus className="h-4 w-4" /> Add Chart
    </Button>
    <Button
      onClick={() => onColumnsChange(1)}
      variant={columns === 1 ? "default" : "outline"}
      size="icon-sm"
    >
      1
    </Button>
    <Button
      onClick={() => onColumnsChange(2)}
      variant={columns === 2 ? "default" : "outline"}
      size="icon-sm"
    >
      2
    </Button>
    {showSidebarButton && (
      <Button onClick={onOpenSidebar} variant="outline" size="icon-sm">
        <ChevronLeft className="h-4 w-4" />
      </Button>
    )}
  </div>
);
