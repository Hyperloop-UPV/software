import { memo, useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useShallow } from "zustand/react/shallow";
import {
  CHART_COLORS,
  CHART_HEIGHT,
  CHART_LINE_WIDTH,
  CHART_MAX_POINTS,
  CHART_POINT_SIZE,
} from "../../../constants/chartConfig";
import { useStore } from "../../../store/store";

export interface SeriesConfig {
  measurementKey: string;
  /** Short label shown in the legend (e.g. "U", "V", "W"). */
  label: string;
  /** Index into CHART_COLORS. Falls back to the series' position index. */
  colorIndex?: number;
}

interface MultiSeriesChartProps {
  title: string;
  series: SeriesConfig[];
  unit?: string;
}

/**
 * Real-time chart with up to 5 simultaneous series — designed for the
 * three-phase DLIM / LSM current charts.
 *
 * Series configs must be a stable reference (defined at module level or
 * memoized) so the Zustand selector and uPlot init only run once.
 *
 * A compact colour-dot legend is rendered in the card header.
 * Double-click resets the zoom.
 */
const MultiSeriesChart = memo(({ title, series, unit = "" }: MultiSeriesChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef     = useRef<uPlot | null>(null);
  const xRef         = useRef<number[]>([]);
  // One data array per series, initialised lazily on first render.
  const yRefs        = useRef<number[][]>(series.map(() => []));
  const counterRef   = useRef(0);

  // Subscribe to all series values at once; useShallow prevents re-renders
  // when the values haven't actually changed.
  const values = useStore(
    // The selector is stable because `series` is a module-level constant.
    useShallow((s) =>
      series.map(({ measurementKey }) => s.telemetry[measurementKey] as number | undefined),
    ),
  );

  // ── Initialise uPlot ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const getVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const uplotSeries: uPlot.Series[] = [
      {}, // x-axis placeholder
      ...series.map(({ label, colorIndex }, i) => {
        const color = CHART_COLORS[(colorIndex ?? i) % CHART_COLORS.length];
        return {
          label,
          stroke: color,
          width:  CHART_LINE_WIDTH,
          points: { show: true, size: CHART_POINT_SIZE, fill: color, width: 0 },
        };
      }),
    ];

    const opts: uPlot.Options = {
      width:   containerRef.current.clientWidth,
      height:  CHART_HEIGHT,
      legend:  { show: false },
      padding: [16, 8, 4, 12],
      scales: {
        x: { time: false },
        y: {
          range: (_, min, max) => {
            if (min === max) return [min - 1, max + 1];
            const span   = max - min;
            const buffer = span * 0.15;
            return [min - buffer, max + buffer];
          },
        },
      },
      series: uplotSeries,
      axes: [
        {
          stroke: getVar("--muted-foreground"),
          grid:   { show: false },
          font:   "10px Archivo",
          size:   20,
        },
        {
          side:   1,
          stroke: getVar("--muted-foreground"),
          grid:   { stroke: getVar("--border") },
          font:   "10px Archivo",
          size:   unit ? 48 : 36,
          label:  unit,
        },
      ],
      cursor: { drag: { setScale: true, x: true, y: true } },
    };

    const initialData: uPlot.AlignedData = [[], ...series.map(() => [] as number[])];
    uplotRef.current = new uPlot(opts, initialData, containerRef.current);

    const handleDblClick = () =>
      uplotRef.current?.setScale("x", {
        min: null as unknown as number,
        max: null as unknown as number,
      });
    containerRef.current.addEventListener("dblclick", handleDblClick);

    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
      containerRef.current?.removeEventListener("dblclick", handleDblClick);
    };
    // Intentionally runs once on mount — series config is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feed new data points ─────────────────────────────────────────────────
  useEffect(() => {
    if (!uplotRef.current) return;
    // Only push a point when every series has a numeric value (all phases
    // arrive in the same telemetry packet so this is normally always true).
    if (!values.every((v) => typeof v === "number")) return;

    xRef.current.push(counterRef.current++);
    (values as number[]).forEach((v, i) => {
      yRefs.current[i].push(v);
    });

    if (xRef.current.length > CHART_MAX_POINTS) {
      xRef.current         = xRef.current.slice(-CHART_MAX_POINTS);
      yRefs.current        = yRefs.current.map((y) => y.slice(-CHART_MAX_POINTS));
    }

    uplotRef.current.setData([xRef.current, ...yRefs.current]);
  }, [values]);

  // ── Resize to container ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        uplotRef.current?.setSize({
          width:  entry.contentRect.width,
          height: CHART_HEIGHT,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-card flex flex-col rounded-xl border shadow-sm">
      <div className="flex items-center justify-between px-4 pt-3">
        {/* Title + inline phase legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-foreground text-sm font-semibold">{title}</span>
          {series.map(({ label, colorIndex }, i) => {
            const color = CHART_COLORS[(colorIndex ?? i) % CHART_COLORS.length];
            return (
              <span key={label} className="flex items-center gap-1">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground text-xs">{label}</span>
              </span>
            );
          })}
        </div>
        {unit && (
          <span className="text-muted-foreground shrink-0 text-xs">{unit}</span>
        )}
      </div>
      <div ref={containerRef} className="w-full px-1 pb-2" />
    </div>
  );
});

MultiSeriesChart.displayName = "MultiSeriesChart";
export default MultiSeriesChart;
