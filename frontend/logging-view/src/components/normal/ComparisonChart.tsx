import * as echarts from "echarts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decimateLTTB } from "../../lib/plotStudio/decimate";
import { lowerBound, upperBound } from "../../lib/plotStudio/range";
import { enumBandColor, enumVariantColor } from "../../lib/normal/enumColors";
import { axisKey } from "../../lib/normal/units";
import { computeStateSegments } from "../../lib/plotStudio/timeline";
import { formatOrderParameters } from "../../lib/orders";
import {
  TIME_DIVISORS,
  type ComparisonSignal,
  type ChartMarker,
  type TimeDomain,
  type TimeRange,
  type TimeUnit,
} from "../../types/normal";
import type { LoggedOrder } from "../../types/session";

interface TooltipPoint {
  seriesIndex: number;
  data?: number[];
  axisValue?: number;
}

interface Props {
  locked: boolean;
  signals: ComparisonSignal[];
  domain: TimeDomain;
  range: TimeRange;
  timeUnit: TimeUnit;
  normalized: boolean;
  isDarkMode: boolean;
  syncGroup: string;
  orders: LoggedOrder[];
  showOrders: boolean;
  markers: ChartMarker[];
  /** An enum drawn as a background wash behind the curves, if any. */
  band: ComparisonSignal | null;
  /** True when every signal is discrete: draw a Gantt-style state timeline. */
  timeline: boolean;
  onRangeChange: (range: TimeRange) => void;
  onMarkerAt: (timeMs: number) => void;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function ComparisonChart({
  locked,
  signals,
  domain,
  range,
  timeUnit,
  normalized,
  isDarkMode,
  syncGroup,
  orders,
  showOrders,
  markers,
  band,
  timeline,
  onRangeChange,
  onMarkerAt,
}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const rangeRef = useRef(range);
  const onRangeChangeRef = useRef(onRangeChange);
  const onMarkerAtRef = useRef(onMarkerAt);
  const domainRef = useRef(domain);
  const timeUnitRef = useRef(timeUnit);
  // The last window this chart pushed to the store. The store pushes every
  // change back (see the effect at the end), so without this we would re-apply
  // our own gesture mid-flight; an external change still gets through.
  const lastSentRef = useRef(range);
  const lockedRef = useRef(locked);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    onRangeChangeRef.current = onRangeChange;
  }, [onRangeChange]);

  useEffect(() => {
    onMarkerAtRef.current = onMarkerAt;
  }, [onMarkerAt]);

  useEffect(() => {
    domainRef.current = domain;
    timeUnitRef.current = timeUnit;
  }, [domain, timeUnit]);

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
  const orderMarkers = useMemo(() => {
    if (!showOrders) return [];
    const duration = domain.endMs - domain.startMs;
    return orders
      .map((order) => ({
        order,
        plotTimeMs:
          (order.absoluteTime ?? domain.startMs + order.time) - domain.startMs,
      }))
      .filter(({ plotTimeMs }) => plotTimeMs >= 0 && plotTimeMs <= duration);
  }, [domain.endMs, domain.startMs, orders, showOrders]);

  // Segments for whatever is drawn from state runs: the background band and
  // every timeline row. Computed on the undecimated series on purpose —
  // decimateLTTB would move the state boundaries, which are the whole point.
  const toPlotTime = useCallback(
    (ms: number) => (ms - domain.startMs) / TIME_DIVISORS[timeUnit],
    [domain.startMs, timeUnit],
  );
  const windowMs = useMemo(() => {
    const span = domain.endMs - domain.startMs;
    return {
      from: domain.startMs + (span * range.start) / 100,
      to: domain.startMs + (span * range.end) / 100,
    };
  }, [domain.startMs, domain.endMs, range.start, range.end]);

  const bandSegments = useMemo(() => {
    if (!band) return [];
    return (
      computeStateSegments(band.data, domain.endMs)
        .filter(
          (segment) =>
            segment.end >= windowMs.from && segment.start <= windowMs.to,
        )
        // A pathologically noisy enum would otherwise emit one mark per sample.
        .slice(0, 1000)
    );
  }, [band, windowMs, domain.endMs]);

  const timelineRows = useMemo(
    () =>
      timeline
        ? signals.map((signal) => `${signal.board} / ${signal.name}`)
        : [],
    [timeline, signals],
  );

  const timelineSegments = useMemo(() => {
    if (!timeline) return [];
    return signals.map((signal) =>
      computeStateSegments(signal.data, domain.endMs)
        .filter(
          (segment) =>
            segment.end >= windowMs.from && segment.start <= windowMs.to,
        )
        .slice(0, 1000),
    );
  }, [timeline, signals, windowMs, domain.endMs]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const chart = echarts.init(element);
    chartRef.current = chart;
    chart.group = syncGroup;
    echarts.connect(syncGroup);
    // ECharts emits its own dataZoom action every 20 ms during a gesture, and
    // each store write re-renders the workspace and re-decimates every pane,
    // so commit at most once per frame. ECharts has already repainted itself,
    // so the visible response stays immediate either way.
    let pending: TimeRange | null = null;
    let frame = 0;
    const commit = () => {
      frame = 0;
      if (!pending) return;
      const next = pending;
      pending = null;
      lastSentRef.current = next;
      onRangeChangeRef.current(next);
    };
    const updateRange = () => {
      const zoom = (chart.getOption() as { dataZoom?: TimeRange[] })
        .dataZoom?.[0];
      if (zoom && Number.isFinite(zoom.start) && Number.isFinite(zoom.end)) {
        pending = { start: zoom.start, end: zoom.end };
        if (!frame) frame = requestAnimationFrame(commit);
      }
    };
    chart.on("datazoom", updateRange);
    const addMarkerAtPixel = (x: number, y: number) => {
      if (lockedRef.current) return;
      const point = chart.convertFromPixel({ xAxisIndex: 0 }, [x, y]);
      const value = Array.isArray(point) ? point[0] : point;
      const currentDomain = domainRef.current;
      const duration = currentDomain.endMs - currentDomain.startMs;
      const convertedTimeMs = Number(value) * TIME_DIVISORS[timeUnitRef.current];
      // convertFromPixel can be unavailable for a just-resized chart. Keep the
      // gesture useful by deriving the same x position from the plot width.
      const fallbackTimeMs =
        (Math.max(0, Math.min(element.clientWidth, x)) /
          Math.max(1, element.clientWidth)) *
        duration;
      const timeMs =
        Number.isFinite(convertedTimeMs) &&
        convertedTimeMs >= 0 &&
        convertedTimeMs <= duration
          ? convertedTimeMs
          : fallbackTimeMs;
      onMarkerAtRef.current(timeMs);
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !element.contains(event.target))
        return;
      const bounds = element.getBoundingClientRect();
      addMarkerAtPixel(event.clientX - bounds.left, event.clientY - bounds.top);
    };
    // zrender can stop the canvas event before it reaches React or the chart
    // container, so capture at the document and scope it back to this chart.
    document.addEventListener("dblclick", onDoubleClick, true);

    // Shift+wheel pans in time. ECharts cannot do this on its own: its roam
    // controller evaluates zoomOnMouseWheel and moveOnMouseWheel
    // independently and fires both events, so `moveOnMouseWheel: "shift"`
    // would pan *and* zoom at once. Plain wheel is left to ECharts' zoom.
    // Capture phase is what puts us ahead of zrender, which binds its own
    // handlers to the div it creates inside this element.
    const onWheel = (event: WheelEvent) => {
      if (!event.shiftKey || lockedRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (delta === 0) return;
      const { start, end } = rangeRef.current;
      const span = end - start;
      const next = Math.max(
        0,
        Math.min(100 - span, start + Math.sign(delta) * span * 0.2),
      );
      if (Math.abs(next - start) < 1e-4) return;
      // Not silent on purpose: this must behave exactly like a drag-pan, i.e.
      // emit datazoom so the commit above and the group broadcast both run.
      chart.dispatchAction({ type: "dataZoom", start: next, end: next + span });
    };
    element.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });

    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth);
      chart.resize();
    });
    observer.observe(element);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener("wheel", onWheel, { capture: true });
      chart.off("datazoom", updateRange);
      document.removeEventListener("dblclick", onDoubleClick, true);
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
    const orderColor = isDarkMode ? "#fbbf24" : "#d97706";
    const markerColor = isDarkMode ? "#67e8f9" : "#0891b2";
    const orderTooltipTolerance = Math.max(
      1e-9,
      ((domain.endMs - domain.startMs) /
        TIME_DIVISORS[timeUnit] /
        Math.max(width, 1)) *
        10,
    );
    const units = normalized
      ? ["Relative (%)"]
      : [...new Set(signals.map(axisKey))];
    // One row per signal, read top to bottom in assignment order.
    const timelineAxis = {
      type: "category" as const,
      data: timelineRows,
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: muted, fontSize: 10, hideOverlap: true },
      splitArea: {
        show: true,
        areaStyle: {
          color: isDarkMode
            ? ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.05)"]
            : ["rgba(0,0,0,0.015)", "rgba(0,0,0,0.04)"],
        },
      },
      splitLine: { show: false },
    };
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
    const orderMarkLine = {
      silent: false,
      symbol: ["none", "circle"],
      symbolSize: [0, 6],
      animation: false,
      lineStyle: {
        color: orderColor,
        width: 1.25,
        type: "dashed",
        opacity: 0.9,
      },
      label: {
        show: orderMarkers.length <= 8,
        color: orderColor,
        fontSize: 9,
        position: "insideEndTop",
        formatter: "{b}",
      },
      data: orderMarkers.map(({ order, plotTimeMs }) => ({
        name:
          order.name.length > 18 ? `${order.name.slice(0, 17)}…` : order.name,
        xAxis: plotTimeMs / TIME_DIVISORS[timeUnit],
        order,
      })),
    };
    const markerMarkLine = {
      silent: true,
      symbol: ["none", "none"],
      animation: false,
      lineStyle: {
        color: markerColor,
        width: 1.25,
        type: "solid",
        opacity: 0.9,
      },
      label: {
        show: true,
        color: markerColor,
        fontSize: 9,
        position: "insideEndTop",
        formatter: "{b}",
      },
      data: markers.map((marker) => ({
        name: marker.label,
        xAxis: marker.timeMs / TIME_DIVISORS[timeUnit],
        lineStyle: { color: markerColor, width: 1.25, type: "solid" },
        label: { color: markerColor },
      })),
    };
    const chartMarkLine = {
      ...orderMarkLine,
      data: [...orderMarkLine.data, ...markerMarkLine.data],
    };
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
        yAxis: timeline ? timelineAxis : axes,
        tooltip: {
          trigger: timeline ? "item" : "axis",
          confine: true,
          backgroundColor: isDarkMode
            ? "rgba(34,39,48,0.97)"
            : "rgba(255,255,255,0.98)",
          borderColor: grid,
          textStyle: { color: text, fontSize: 12 },
          formatter: (raw: unknown) => {
            const params = (Array.isArray(raw) ? raw : [raw]) as TooltipPoint[];
            if (timeline) {
              const point = params[0];
              const signal = signals[point?.seriesIndex ?? -1];
              const data = point?.data;
              if (!signal || !data) return "";
              const [from, to, , code] = data;
              const label =
                signal.enumLabels?.[Math.round(code)] ?? String(code);
              const span = (to - from).toLocaleString(undefined, {
                maximumFractionDigits: 3,
              });
              return (
                `<b>${escapeHtml(label)}</b><br/>` +
                `<span style="color:${muted}">${escapeHtml(signal.board)} / ${escapeHtml(signal.name)}</span><br/>` +
                `${from.toLocaleString(undefined, { maximumFractionDigits: 3 })} → ` +
                `${to.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${timeUnit}` +
                ` <b>(${span} ${timeUnit})</b>`
              );
            }
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
            const orderRows = orderMarkers
              .filter(
                ({ plotTimeMs }) =>
                  Math.abs(plotTimeMs / TIME_DIVISORS[timeUnit] - time) <=
                  orderTooltipTolerance,
              )
              .map(
                ({ order }) =>
                  `<div style="margin-top:7px;border-top:1px solid ${grid};padding-top:6px"><span style="color:${orderColor}">◆</span> <b>${escapeHtml(order.name)}</b><br/><span style="margin-left:12px">${escapeHtml(order.from)} → ${escapeHtml(order.to)} · ${formatOrderParameters(order.parameters)}</span></div>`,
              )
              .join("");
            // The band is a silent markArea, so it contributes no param of
            // its own; look its state up by the hovered time instead.
            const bandRow = (() => {
              if (!band) return "";
              const segment = bandSegments.find(
                (current) =>
                  toPlotTime(current.start) <= time &&
                  time <= toPlotTime(current.end),
              );
              if (!segment) return "";
              const label =
                band.enumLabels?.[Math.round(segment.value)] ??
                String(segment.value);
              return `<div style="margin-top:5px"><span style="color:${enumVariantColor(Math.round(segment.value))}">▮</span> ${escapeHtml(band.board)} / ${escapeHtml(band.name)} <b style="margin-left:12px">${escapeHtml(label)}</b></div>`;
            })();
            return `<b>${time.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${timeUnit}</b>${rows}${bandRow}${orderRows}`;
          },
        },
        dataZoom: [
          {
            type: "inside",
            disabled: locked,
            xAxisIndex: 0,
            ...rangeRef.current,
            filterMode: "none",
            throttle: 100,
            zoomOnMouseWheel: !locked,
            moveOnMouseMove: !locked,
            moveOnMouseWheel: false,
          },
        ],
        series: (timeline
          ? signals.map((signal, index) => ({
              id: signal.id,
              name: timelineRows[index],
              // A custom series keeps the x axis a value axis in time units,
              // so the existing dataZoom and the order markLine keep working;
              // stacked bars would have forced a category x axis.
              type: "custom" as const,
              clip: true,
              animation: false,
              encode: { x: [0, 1], y: 2 },
              renderItem: (
                params: echarts.CustomSeriesRenderItemParams,
                api: echarts.CustomSeriesRenderItemAPI,
              ) => {
                const row = api.value(2) as number;
                const start = api.coord([api.value(0) as number, row]);
                const end = api.coord([api.value(1) as number, row]);
                const height = (api.size?.([0, 1]) as number[])[1] * 0.62;
                // The cartesian coord sys does carry the rect; the union
                // type ECharts declares for renderItem does not say so.
                const coordSys = params.coordSys as unknown as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                };
                const shape = echarts.graphic.clipRectByRect(
                  {
                    x: start[0],
                    y: start[1] - height / 2,
                    width: Math.max(1, end[0] - start[0]),
                    height,
                  },
                  coordSys,
                );
                if (!shape) return undefined;
                return {
                  type: "rect" as const,
                  shape,
                  style: {
                    fill: enumVariantColor(Math.round(api.value(3) as number)),
                  },
                };
              },
              data: timelineSegments[index].map((segment) => [
                toPlotTime(segment.start),
                toPlotTime(segment.end),
                index,
                segment.value,
              ]),
              ...(index === 0 && (orderMarkers.length > 0 || markers.length > 0)
                ? { markLine: chartMarkLine }
                : {}),
            }))
          : signals.map((signal, index) => ({
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
              ...(index === 0 && (orderMarkers.length > 0 || markers.length > 0)
                ? { markLine: chartMarkLine }
                : {}),
              // Marks belong to a series, and series 0 is the one proven to
              // draw them, so the band rides along with the order markers.
              ...(index === 0 && bandSegments.length > 0
                ? {
                    markArea: {
                      // Out of the axis tooltip: its state is added by hand in
                      // the formatter above.
                      silent: true,
                      animation: false,
                      data: bandSegments.map((segment) => [
                        {
                          xAxis: toPlotTime(segment.start),
                          itemStyle: {
                            color: enumBandColor(
                              Math.round(segment.value),
                              isDarkMode,
                            ),
                          },
                        },
                        { xAxis: toPlotTime(segment.end) },
                      ]),
                    },
                  }
                : {}),
            }))) as echarts.SeriesOption[],
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
    locked,
    orderMarkers,
    markers,
    timeline,
    timelineRows,
    timelineSegments,
    band,
    bandSegments,
    toPlotTime,
  ]);

  useEffect(() => {
    rangeRef.current = range;
    // Our own commit coming back round: the chart is already showing it.
    if (
      Math.abs(range.start - lastSentRef.current.start) < 1e-4 &&
      Math.abs(range.end - lastSentRef.current.end) < 1e-4
    ) {
      return;
    }
    lastSentRef.current = range;
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
