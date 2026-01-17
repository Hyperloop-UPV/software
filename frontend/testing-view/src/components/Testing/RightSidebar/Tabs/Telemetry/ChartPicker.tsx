import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui";
import { Plus } from "@workspace/ui/icons";
import type { WorkspaceChartConfig } from "../../../../../store/slices/workspacesSlice";

interface ChartPickerProps {
  charts: WorkspaceChartConfig[];
  onAdd: (chartId: string) => void;
  onCreate: () => void;
}

const ChartPicker = ({ charts, onAdd, onCreate }: ChartPickerProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-muted-foreground text-[10px] uppercase">
          Add to chart
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {charts.length > 0 ? (
          charts.map((chart, idx) => (
            <DropdownMenuItem
              key={chart.id}
              onClick={() => onAdd(chart.id)}
              className="text-xs"
            >
              Chart {idx + 1} ({chart.series.length} series)
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled className="text-xs italic">
            No active charts
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onCreate} className="text-xs">
          Create new chart
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChartPicker;
