import { Eye, EyeOff, X } from "@workspace/ui/icons";
import { COLORS } from "../constants/chartsColors";
import type { WorkspaceChartSeries } from "../types/charts";
import { ChartSettings } from "./ChartSettings";

interface ChartLegendProps {
  chartId: string;
  series: WorkspaceChartSeries[];
  disabledVariables: Set<string>;
  visibleValueLabels: Set<string>;
  valueLabelRefs: { current: Map<string, HTMLElement> };
  onToggle: (seriesKey: string) => void;
  onToggleValueLabel: (seriesKey: string) => void;
  onRemove: (variable: string) => void;
}

export const ChartLegend = ({
  chartId,
  series,
  disabledVariables,
  visibleValueLabels,
  valueLabelRefs,
  onToggle,
  onToggleValueLabel,
  onRemove,
}: ChartLegendProps) => (
  <div className="border-border mb-4 flex flex-wrap gap-2 border-b pb-3 pr-14">
    {series.map((p, i) => (
      <div
        key={i}
        className="border-border flex items-center overflow-hidden rounded-md border shadow-sm transition-transform active:scale-95"
      >
        <button
          onClick={() => onToggle(p.variable)}
          className={`flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
            disabledVariables.has(p.variable)
              ? "bg-muted text-muted-foreground grayscale"
              : "bg-background text-foreground hover:bg-accent"
          }`}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: COLORS[i % COLORS.length] }}
          />
          {p.variable}
          {visibleValueLabels.has(p.variable) && (
            <span
              ref={(el) => {
                if (el) valueLabelRefs.current.set(p.variable, el);
                else valueLabelRefs.current.delete(p.variable);
              }}
              className="text-muted-foreground text-[11px] tabular-nums normal-case"
            />
          )}
        </button>
        <button
          title={
            visibleValueLabels.has(p.variable)
              ? `Hide value label for ${p.variable}`
              : `Show value label for ${p.variable}`
          }
          onClick={() => onToggleValueLabel(p.variable)}
          className={`border-border h-full border-l px-1.5 py-1 transition-colors ${
            visibleValueLabels.has(p.variable)
              ? "text-foreground hover:bg-accent"
              : "text-muted-foreground/40 hover:text-muted-foreground"
          }`}
        >
          {visibleValueLabels.has(p.variable) ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3" />
          )}
        </button>
        <button
          title={`Remove variable ${p.variable}`}
          onClick={() => onRemove(p.variable)}
          className="border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-full border-l px-1.5 py-1 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ))}
    <ChartSettings chartId={chartId} />
  </div>
);
