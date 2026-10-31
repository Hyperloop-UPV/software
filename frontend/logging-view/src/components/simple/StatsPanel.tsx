// Statistics panel shown under a plot. Metrics are computed over the visible
// X range only (live — the parent tracks the current Plotly viewport,
// debounced, and passes it down as `visibleRange`).
import { Button, Separator } from "@hyperloop-upv/frontend-kit/components";
import { X } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useMemo } from "react";
import { fmt } from "../../lib/plotStudio/format";
import { computeRangeStats } from "../../lib/plotStudio/stats";
import type { SeriesData } from "../../types/plotStudio";

interface SignalEntry {
  signalId: string;
  name: string;
  data: SeriesData | null;
  /** Trace color from lib/plotStudio/palette — matches the curve in the chart. */
  color: string;
}

interface StatsPanelProps {
  signalData: SignalEntry[];
  visibleRange: [number, number] | null;
  onClose: () => void;
}

const STAT_CARDS = [
  { key: "mean",       label: "Mean",          color: "text-foreground" },
  { key: "std",        label: "Std Dev σ",     color: "text-blue-500" },
  { key: "rms",        label: "RMS",           color: "text-violet-500" },
  { key: "peakToPeak", label: "Peak-to-Peak",  color: "text-amber-500" },
  { key: "min",        label: "Min",           color: "text-emerald-500" },
  { key: "max",        label: "Max",           color: "text-rose-500" },
  { key: "noiseFloor", label: "Noise Floor σ", color: "text-primary", primary: true },
  { key: "count",      label: "Samples",       color: "text-muted-foreground", integer: true },
] as const;

export default function StatsPanel({ signalData, visibleRange, onClose }: StatsPanelProps) {
  const rangeLabel = visibleRange ? `${visibleRange[0].toFixed(2)} – ${visibleRange[1].toFixed(2)} ms` : "full signal";

  const computed = useMemo(
    () => signalData.map((s) => ({
      signalId: s.signalId, name: s.name, color: s.color,
      result: s.data && s.data.value.length >= 2 ? computeRangeStats(s.data, visibleRange) : null,
    })),
    [signalData, visibleRange],
  );

  return (
    <div className="border-t">
      {/* Header */}
      <div className="from-primary/5 flex items-center justify-between bg-gradient-to-r to-transparent px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="text-primary shrink-0">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
          <span className="text-foreground text-xs font-semibold">Signal Statistics</span>
          <span className="text-muted-foreground hidden text-[10px] sm:inline">— updates with zoom</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-[10px]">
            Range: <span className="text-foreground font-mono font-medium">{rangeLabel}</span>
          </span>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close statistics"
            className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <Separator />

      {computed.every((s) => !s.result) ? (
        <div className="text-muted-foreground py-6 text-center text-sm">
          No data to analyze in the current range.
        </div>
      ) : (
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-card text-muted-foreground sticky left-0 z-10 max-w-[180px] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide">
                  Signal
                </th>
                {STAT_CARDS.map(({ key, label, color, ...rest }) => (
                  <th
                    key={key}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide",
                      "primary" in rest && rest.primary ? color : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.map(({ signalId, name, color, result }) => {
                if (!result) return null;
                const { stats, floor } = result;
                const values: Record<string, number> = {
                  mean: stats.mean, std: stats.std, rms: stats.rms,
                  peakToPeak: stats.peakToPeak, min: stats.min, max: stats.max,
                  noiseFloor: floor.noiseFloor, count: stats.count,
                };

                return (
                  <tr key={signalId} className="odd:bg-muted/20">
                    <td className="bg-card sticky left-0 z-10 max-w-[180px] px-3 py-2 [tr:nth-child(odd)_&]:bg-muted/20">
                      <div className="flex min-w-0 items-center gap-2">
                        {/* Dot matches the trace color in the chart */}
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-foreground truncate font-semibold" title={name}>{name}</span>
                      </div>
                    </td>
                    {STAT_CARDS.map(({ key, ...rest }) => (
                      <td key={key} className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">
                        {fmt(values[key], "integer" in rest && rest.integer)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
