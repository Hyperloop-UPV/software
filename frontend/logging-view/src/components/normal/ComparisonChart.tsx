import * as echarts from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { decimateLTTB } from "../../lib/plotStudio/decimate";
import { lowerBound, upperBound } from "../../lib/plotStudio/range";
import { axisKey } from "../../lib/normal/units";
import {
  TIME_DIVISORS,
  type ComparisonSignal,
  type TimeDomain,
  type TimeRange,
  type TimeUnit,
} from "../../types/normal";

interface TooltipPoint {
  seriesIndex: number;
  data?: number[];
  axisValue?: number;
}

interface Props {
  signals: ComparisonSignal[];
  domain: TimeDomain;
  range: TimeRange;
  timeUnit: TimeUnit;
  normalized: boolean;
  isDarkMode: boolean;
  syncGroup: string;
  onRangeChange: (range: TimeRange) => void;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function ComparisonChart({
  signals,
  domain,
  range,
  timeUnit,
  normalized,
  isDarkMode,
  syncGroup,
  onRangeChange,
}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const rangeRef = useRef(range);
  const onRangeChangeRef = useRef(onRangeChange);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    onRangeChangeRef.current = onRangeChange;
  }, [onRangeChange]);

  // Keep normalization relative to the whole recording while sampling only
  // the visible interval so zooming reveals samples omitted at wider scales.
  const extents = useMemo(
    () =>
      signals.map((signal) => {
        let min = Infinity;
        let max = -Infinity;
        for (const value of signal.data.value) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        return { min, max };
      }),
    [signals],
  );

  const prepared = useMemo(
    () =>
      signals.map((signal, signalIndex) => {
        const { min, max } = extents[signalIndex];
        const duration = domain.endMs - domain.startMs;
        // Include neighbours to retain lines crossing either viewport edge.
        const first = Math.max(
          0,
          lowerBound(
            signal.data.time,
            domain.startMs + (duration * range.start) / 100,
          ) - 1,
        );
        const last = Math.min(
          signal.data.time.length,
          upperBound(
            signal.data.time,
            domain.startMs + (duration * range.end) / 100,
          ) + 1,
        );
        const sampled = decimateLTTB(
          signal.data.time.subarray(first, last),
          signal.data.value.subarray(first, last),
          8_000,
        );
        return Array.from(sampled.time, (time, index) => {
          const raw = sampled.value[index];
          return [
            (time - domain.startMs) / TIME_DIVISORS[timeUnit],
            normalized
              ? max === min
                ? 50
                : ((raw - min) / (max - min)) * 100
              : raw,
            raw,
          ];
        });
      }),
    [
      signals,
      extents,
      domain.startMs,
      domain.endMs,
      range,
      timeUnit,
      normalized,
    ],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const chart = echarts.init(element);
    chartRef.current = chart;
    chart.group = syncGroup;
    echarts.connect(syncGroup);
    const updateRange = () => {
      const zoom = (chart.getOption() as { dataZoom?: TimeRange[] })
        .dataZoom?.[0];
      if (zoom && Number.isFinite(zoom.start) && Number.isFinite(zoom.end)) {
        onRangeChangeRef.current({ start: zoom.start, end: zoom.end });
      }
    };
    chart.on("datazoom", updateRange);
    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth);
      chart.resize();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.off("datazoom", updateRange);
      chart.dispose();
      chartRef.current = null;
    };
  }, [syncGroup]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || signals.length === 0) return;
    rangeRef.current = range;
    const text = isDarkMode ? "#d5d8df" : "#374151";
    const muted = isDarkMode ? "#9ba3b2" : "#6b7280";
    const grid = isDarkMode ? "#3a404b" : "#e6e9ef";
    const units = normalized
      ? ["Relative (%)"]
      : [...new Set(signals.map(axisKey))];
    const axes = units.map((unit, index) => {
      const signal = signals.find((item) => axisKey(item) === unit);
      return {
        type: "value" as const,
        name: normalized ? "Relative (%)" : signal?.discrete ? "State" : unit,
        nameLocation: "middle" as const,
        nameGap: 48,
        nameTextStyle: { color: muted, fontSize: 11 },
        position: index === 0 ? ("left" as const) : ("right" as const),
        min: normalized ? 0 : undefined,
        max: normalized ? 100 : undefined,
        scale: !normalized,
        minInterval: signal?.discrete ? 1 : undefined,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 10,
          hideOverlap: true,
          formatter:
            signal?.enumLabels && !normalized
              ? (value: number) => signal.enumLabels?.[value] ?? String(value)
              : undefined,
        },
        splitLine: {
          show: index === 0,
          lineStyle: { color: grid, type: "dashed" as const },
        },
      };
    });
    chart.setOption(
      {
        backgroundColor: "transparent",
        animation: false,
        textStyle: { color: text },
        grid: {
          left: width < 420 ? 62 : 72,
          right: axes.length > 1 ? 72 : 22,
          top: 22,
          bottom: 54,
        },
        xAxis: {
          type: "value",
          min: 0,
          max: Math.max(
            1 / TIME_DIVISORS[timeUnit],
            (domain.endMs - domain.startMs) / TIME_DIVISORS[timeUnit],
          ),
          name: `Time (${timeUnit})`,
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: { color: muted, fontSize: 11 },
          axisLine: { lineStyle: { color: grid } },
          axisTick: { show: false },
          axisLabel: { color: muted, hideOverlap: true, fontSize: 10 },
          splitLine: { lineStyle: { color: grid, opacity: 0.6 } },
          axisPointer: {
            show: true,
            label: { show: false },
            lineStyle: { color: muted, type: "dashed" },
          },
        },
        yAxis: axes,
        tooltip: {
          trigger: "axis",
          confine: true,
          backgroundColor: isDarkMode
            ? "rgba(34,39,48,0.97)"
            : "rgba(255,255,255,0.98)",
          borderColor: grid,
          textStyle: { color: text, fontSize: 12 },
          formatter: (raw: unknown) => {
            const params = (Array.isArray(raw) ? raw : [raw]) as TooltipPoint[];
            const time = Number(
              params[0]?.data?.[0] ?? params[0]?.axisValue ?? 0,
            );
            const rows = params
              .map((param) => {
                const signal = signals[param.seriesIndex];
                if (!signal) return "";
                const value = Number(param.data?.[2] ?? param.data?.[1]);
                if (!Number.isFinite(value)) return "";
                const state = signal.discrete
                  ? signal.enumLabels?.[Math.round(value)]
                  : undefined;
                const shown =
                  state ??
                  `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}${signal.units ? ` ${signal.units}` : ""}`;
                return `<div style="margin-top:5px"><span style="color:${signal.color}">●</span> ${escapeHtml(signal.board)} / ${escapeHtml(signal.name)} <b style="margin-left:12px">${escapeHtml(shown)}</b></div>`;
              })
              .join("");
            return `<b>${time.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${timeUnit}</b>${rows}`;
          },
        },
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: 0,
            ...rangeRef.current,
            filterMode: "none",
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
          },
        ],
        series: signals.map((signal, index) => ({
          id: signal.id,
          name: `${signal.board} / ${signal.name}`,
          type: "line",
          yAxisIndex: normalized ? 0 : units.indexOf(axisKey(signal)),
          data: prepared[index],
          showSymbol: signal.data.time.length < 20,
          symbolSize: 5,
          step: signal.discrete ? "end" : false,
          lineStyle: { color: signal.color, width: 1.8 },
          itemStyle: { color: signal.color },
          emphasis: { focus: "series" },
          progressive: 5000,
        })),
      },
      true,
    );
    chart.resize();
  }, [
    signals,
    prepared,
    domain,
    range,
    timeUnit,
    normalized,
    isDarkMode,
    width,
  ]);

  useEffect(() => {
    rangeRef.current = range;
    chartRef.current?.dispatchAction(
      { type: "dataZoom", ...range },
      { silent: true },
    );
  }, [range]);

  return (
    <div
      ref={elementRef}
      className="h-full min-h-0 w-full"
      aria-label="Interactive signal chart"
    />
  );
}
