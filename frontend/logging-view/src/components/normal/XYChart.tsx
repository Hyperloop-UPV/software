// One signal against another, inside the plot's current time window: each
// point is a pair of values the two signals had at the same instant, aligned
// the way formulas align their inputs.
import * as echarts from "echarts";
import { useEffect, useMemo, useRef, type Ref } from "react";
import { alignOnGrid } from "../../lib/normal/formula";
import {
  chartBackground,
  useChartHandle,
  type ChartHandle,
} from "../../lib/normal/chartImage";
import { lowerBound, upperBound } from "../../lib/plotStudio/range";
import {
  TIME_DIVISORS,
  type ComparisonSignal,
  type TimeDomain,
  type TimeRange,
  type TimeUnit,
} from "../../types/normal";

const MAX_POINTS = 8_000;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const format = (value: number) =>
  value.toLocaleString(undefined, { maximumSignificantDigits: 6 });

const label = (signal: ComparisonSignal) =>
  `${signal.board} / ${signal.name}${signal.units ? ` (${signal.units})` : ""}`;

/** [x, y, time] triples of `y` against `x` within [fromMs, toMs]. */
function pairs(
  x: ComparisonSignal,
  y: ComparisonSignal,
  fromMs: number,
  toMs: number,
  domainStartMs: number,
  divisor: number,
): number[][] {
  // Cut to the window first (plus a neighbour each side for interpolation),
  // so a short window over a long log stays cheap.
  const cut = (signal: ComparisonSignal) => {
    const { time, value } = signal.data;
    const first = Math.max(0, lowerBound(time, fromMs) - 1);
    const last = Math.min(time.length, upperBound(time, toMs) + 1);
    return {
      data: {
        time: time.subarray(first, last),
        value: value.subarray(first, last),
      },
      discrete: signal.discrete,
    };
  };
  const aligned = alignOnGrid([cut(x), cut(y)]);
  if (!aligned) return [];
  const { grid, values } = aligned;
  const inside: number[] = [];
  for (let i = 0; i < grid.length; i++)
    if (
      grid[i] >= fromMs &&
      grid[i] <= toMs &&
      Number.isFinite(values[0][i]) &&
      Number.isFinite(values[1][i])
    )
      inside.push(i);
  const stride = Math.max(1, Math.ceil(inside.length / MAX_POINTS));
  const out: number[][] = [];
  for (let k = 0; k < inside.length; k += stride) {
    const i = inside[k];
    out.push([values[0][i], values[1][i], (grid[i] - domainStartMs) / divisor]);
  }
  return out;
}

export default function XYChart({
  x,
  signals,
  domain,
  range,
  timeUnit,
  isDarkMode,
  handleRef,
}: {
  x: ComparisonSignal;
  /** Drawn on the y axis; discrete ones are left out by the caller. */
  signals: ComparisonSignal[];
  domain: TimeDomain;
  range: TimeRange;
  timeUnit: TimeUnit;
  isDarkMode: boolean;
  handleRef?: Ref<ChartHandle>;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useChartHandle(handleRef, chartRef, chartBackground(isDarkMode));

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const chart = echarts.init(element);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  const series = useMemo(() => {
    const duration = domain.endMs - domain.startMs;
    const fromMs = domain.startMs + (duration * range.start) / 100;
    const toMs = domain.startMs + (duration * range.end) / 100;
    return signals.map((signal) => ({
      signal,
      data: pairs(
        x,
        signal,
        fromMs,
        toMs,
        domain.startMs,
        TIME_DIVISORS[timeUnit],
      ),
    }));
  }, [x, signals, domain, range, timeUnit]);

  useEffect(() => {
    // Effects run in declaration order: on mount the chart exists already.
    const chart = chartRef.current;
    if (!chart) return;
    const text = isDarkMode ? "#d5d8df" : "#374151";
    const muted = isDarkMode ? "#9ba3b2" : "#6b7280";
    const grid = isDarkMode ? "#3a404b" : "#e6e9ef";
    const yUnits = [...new Set(signals.map((signal) => signal.units ?? ""))];
    const axis = (name: string) => ({
      type: "value" as const,
      scale: true,
      name,
      nameLocation: "middle" as const,
      nameTextStyle: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 10, hideOverlap: true },
      splitLine: { lineStyle: { color: grid, type: "dashed" as const } },
    });
    chart.setOption(
      {
        backgroundColor: "transparent",
        animation: false,
        textStyle: { color: text },
        grid: { left: 72, right: 22, top: 22, bottom: 54 },
        xAxis: { ...axis(label(x)), nameGap: 30 },
        yAxis: {
          ...axis(
            signals.length === 1
              ? label(signals[0])
              : yUnits.filter(Boolean).join(" · "),
          ),
          nameGap: 48,
        },
        tooltip: {
          trigger: "item",
          confine: true,
          backgroundColor: isDarkMode
            ? "rgba(34,39,48,0.97)"
            : "rgba(255,255,255,0.98)",
          borderColor: grid,
          textStyle: { color: text, fontSize: 12 },
          formatter: (raw: unknown) => {
            const point = raw as { seriesIndex: number; data: number[] };
            const signal = signals[point.seriesIndex];
            if (!signal) return "";
            const [xValue, yValue, time] = point.data;
            return (
              `<b>${format(time)} ${timeUnit}</b>` +
              `<div style="margin-top:5px">${escapeHtml(label(x))} <b style="margin-left:8px">${format(xValue)}</b></div>` +
              `<div><span style="color:${signal.color}">●</span> ${escapeHtml(label(signal))} <b style="margin-left:8px">${format(yValue)}</b></div>`
            );
          },
        },
        dataZoom: [
          { type: "inside", xAxisIndex: 0, filterMode: "none" },
          { type: "inside", yAxisIndex: 0, filterMode: "none" },
        ],
        series: series.map(({ signal, data }) => ({
          id: signal.id,
          name: label(signal),
          type: "line",
          data,
          showSymbol: true,
          symbolSize: 3,
          lineStyle: { color: signal.color, width: 1, opacity: 0.45 },
          itemStyle: { color: signal.color },
          emphasis: { focus: "series" },
        })),
      },
      true,
    );
  }, [series, signals, x, isDarkMode, timeUnit]);

  const empty = series.every(({ data }) => data.length === 0);
  return (
    <div className="relative h-full min-h-0 w-full">
      <div
        ref={elementRef}
        className="h-full min-h-0 w-full"
        aria-label="X-Y chart"
      />
      {empty && (
        <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-xs">
          {signals.length === 0
            ? "Add a numeric measurement to draw it against the X axis."
            : "These signals do not overlap in time inside this window."}
        </p>
      )}
    </div>
  );
}
