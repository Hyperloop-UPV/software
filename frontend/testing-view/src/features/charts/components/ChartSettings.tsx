import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui";
import { Settings2 } from "@workspace/ui/icons";
import { config } from "../../../../config";
import { useStore } from "../../../store/store";

interface ChartSettingsProps {
  chartId: string;
}

export const ChartSettings = ({ chartId }: ChartSettingsProps) => {
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const historyLimit = useStore(
    (s) =>
      s.charts[activeWorkspace?.id ?? ""]?.find((c) => c.id === chartId)
        ?.historyLimit ?? config.FALLBACK_CHART_HISTORY_LIMIT,
  );
  const setHistoryLimit = useStore((s) => s.setChartHistoryLimit);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-7 w-7 transition-colors"
          title="Chart Settings"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="border-border bg-popover w-64 p-4 shadow-xl"
      >
        <div className="flex flex-col gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                Buffer Size
              </Label>
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] font-bold">
                {historyLimit} pts
              </span>
            </div>

            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={historyLimit}
              onChange={(e) =>
                activeWorkspace?.id &&
                setHistoryLimit(
                  activeWorkspace.id,
                  chartId,
                  Number(e.target.value),
                )
              }
              className="bg-muted accent-primary hover:accent-primary/80 h-1.5 w-full cursor-pointer appearance-none rounded-lg transition-all"
            />

            <div className="text-muted-foreground flex justify-between text-[9px] font-medium uppercase">
              <span>Performance</span>
              <span>Detail</span>
            </div>
          </div>

          <div className="border-border border-t pt-3">
            <p className="text-muted-foreground text-[10px] italic leading-relaxed">
              Adjust how many data points are kept in memory. Lower values
              improve performance on slower devices.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
