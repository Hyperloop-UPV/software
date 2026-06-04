import { memo, useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import {
  CHART_COLORS,
  CHART_HEIGHT,
  CHART_LINE_WIDTH,
  CHART_MAX_POINTS,
  CHART_POINT_SIZE,
} from "../../../constants/chartConfig";
import useMeasurement from "../../../hooks/useMeasurement";

interface TelemetryChartProps {
  /** Human-readable label shown in the card header. */
  title: string;
  /** Backend telemetry key to track (e.g. "PCU/speetec_velocity"). */
  measurementKey: string;
  /** Unit appended to the y-axis label. */
  unit?: string;
  /** Index into CHART_COLORS. Defaults to 0 (primary orange). */
  colorIndex?: number;
}

/**
 * Fixed single-series real-time chart for competition telemetry.
 *
 * History is accumulated in a local ref (no store involvement) so the
 * component stays lightweight. The x-axis is a monotonic counter driven
 * by incoming telemetry packets. Double-click resets the zoom.
 */
const TelemetryChart = memo(({
  title,
  measurementKey,
  unit = "",
  colorIndex = 0,
}: TelemetryChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef     = useRef<uPlot | null>(null);
  const xRef         = useRef<number[]>([]);
  const yRef         = useRef<number[]>([]);
  const counterRef   = useRef(0);

  const value = useMeasurement(measurementKey);
  const color = CHART_COLORS[colorIndex % CHART_COLORS.length];

  // ── Initialise uplot ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const getVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const opts: uPlot.Options = {
      width:  containerRef.current.clientWidth,
      height: CHART_HEIGHT,
      legend: { show: false },
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
      series: [
        {},
        {
          label:  measurementKey,
          stroke: color,
          width:  CHART_LINE_WIDTH,
          points: { show: true, size: CHART_POINT_SIZE, fill: color, width: 0 },
        },
      ],
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

    uplotRef.current = new uPlot(opts, [[], []], containerRef.current);

    const handleDblClick = () => uplotRef.current?.setScale("x", { min: undefined, max: undefined });
    containerRef.current.addEventListener("dblclick", handleDblClick);

    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
      containerRef.current?.removeEventListener("dblclick", handleDblClick);
    };
  // Intentionally runs once on mount — series config is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feed new data points ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof value !== "number" || !uplotRef.current) return;

    xRef.current.push(counterRef.current++);
    yRef.current.push(value);

    if (xRef.current.length > CHART_MAX_POINTS) {
      xRef.current = xRef.current.slice(-CHART_MAX_POINTS);
      yRef.current = yRef.current.slice(-CHART_MAX_POINTS);
    }

    uplotRef.current.setData([xRef.current, yRef.current]);
  }, [value]);

  // ── Resize to container ─────────────────────────────────────────────────
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
        <span className="text-foreground text-sm font-semibold">{title}</span>
        {unit && (
          <span className="text-muted-foreground text-xs">{unit}</span>
        )}
      </div>
      <div ref={containerRef} className="w-full px-1 pb-2" />
    </div>
  );
});

TelemetryChart.displayName = "TelemetryChart";

export default TelemetryChart;
