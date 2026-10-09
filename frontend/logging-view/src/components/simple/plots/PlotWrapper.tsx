// One plot card: header (rename, zoom, stats, export, delete), Plotly chart,
// drag-to-resize handle and an optional statistics panel.
// Trace colors are pinned via lib/plotStudio/palette so sidebar chips and
// stats headers can mirror the exact color of each curve.
import { useDroppable } from "@dnd-kit/core";
import {
  Button,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Input,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Lock,
  Pencil,
  RefreshCw,
  Trash2,
  Unlock,
} from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import logoIcon from "@workspace/ui/outreach/main/logo_icon.svg?inline";
import Plotly from "plotly.js-dist";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { decimateLTTB } from "../../../lib/plotStudio/decimate";
import { computeFFT } from "../../../lib/plotStudio/fft";
import { exportTimestamp } from "../../../lib/plotStudio/format";
import { formatOrderAnnotation } from "../../../lib/orders";
import { traceColor, resolveSignalColor } from "../../../lib/plotStudio/palette";
import { buildPlotLayout, buildTimelineLayout, getPlotlyTheme } from "../../../lib/plotStudio/plotlyTheme";
import { lowerBound, upperBound } from "../../../lib/plotStudio/range";
import { computeStateSegments, isDiscreteSeries, stateLabel } from "../../../lib/plotStudio/timeline";
import { commonUnits, getEnumLabels, getSignalName, getSignalType, getSignalUnits, isDiscreteMeasurement, unitsMismatch } from "../../../lib/plotStudio/units";
import { displayName, getSignal } from "../../../store/slices/plotStudioSlice";
import { useStore } from "../../../store/store";
import type { PlotState } from "../../../types/plotStudio";
import StatsPanel from "../StatsPanel";
import PlotlyChart, { type PlotlyChartHandle } from "./PlotlyChart";

const PLOTLY_CONFIG: Partial<Plotly.Config> = {
  responsive: true,
  displayModeBar: true,
  displaylogo: false,
  scrollZoom: true,
  showTips: false,
  // Plotly's own built-in "Download plot as a PNG" button is removed —
  // it snapshots the raw on-screen (dark-mode) canvas with no branding,
  // unlike the header's "Export PNG" button (exportPNG below), which always
  // renders in the light/print theme with the Hyperloop logo watermark.
  // Keeping both around meant whichever one a user reached for (this one
  // sits right in the modebar, next to Autoscale/Reset axes) gave
  // inconsistent, sometimes unbranded exports.
  modeBarButtonsToRemove: ["select2d", "lasso2d", "toImage"],
  modeBarButtonsToAdd: ["togglespikelines", "hoverclosest", "hovercompare"],
  editable: true,
};

// Above this point count, decimate before handing points to Plotly (always
// SVG scatter — see the comment in the traces useMemo below for why not GL).
// A full-resolution SVG path with hundreds of thousands of vertices
// is what actually freezes the tab; ~8k is comfortably smooth to paint/pan
// and visually indistinguishable at typical screen widths.
const DECIMATE_THRESHOLD = 8_000;
const ORDER_EVENT_COLOR = "#ff7f0e";

// Plotly divs expose a Node-style event emitter after newPlot()
type PlotlyEventDiv = HTMLDivElement & {
  on?: (event: string, cb: () => void) => void;
  removeAllListeners?: (event: string) => void;
};

/** Assign labels to vertical lanes. Plotly annotations know no collision
 * avoidance, so nearby events would otherwise all occupy the same title
 * position. The line itself remains at the exact event timestamp. */
type OrderLabelPlacement = "top" | "bottom" | "inside";

function assignOrderLabelLanes<T extends { time: number; name: string }>(orders: T[]): Array<{
  order: T;
  placement: OrderLabelPlacement;
  lane: number;
}> {
  if (orders.length === 0) return [];
  const sorted = [...orders].sort((a, b) => a.time - b.time);
  const range = Math.max(1, sorted[sorted.length - 1].time - sorted[0].time);
  const zoneEnds: Record<OrderLabelPlacement, number[]> = { top: [], bottom: [], inside: [] };
  const findOpenLane = (placement: OrderLabelPlacement, time: number, width: number, limit: number) => {
    const ends = zoneEnds[placement];
    let lane = ends.findIndex((end) => end < time);
    if (lane === -1 && ends.length < limit) lane = ends.length;
    if (lane === -1) return null;
    ends[lane] = time + width;
    return lane;
  };

  return sorted.map((order) => {
    // Roughly translate label characters to their horizontal share of a
    // typical chart. Exact browser text measurement is deliberately avoided
    // here so exports and live charts use the same stable lane assignment.
    const labelWidth = Math.min(range * 0.32, Math.max(range * 0.055, range * (order.name.length + 24) / 110));
    // Use the clear margins first. Only densely clustered labels fall back
    // into the plot body, where they are vertically stacked by lane.
    const topLane = findOpenLane("top", order.time, labelWidth, 1);
    if (topLane !== null) return { order, placement: "top", lane: topLane };
    const bottomLane = findOpenLane("bottom", order.time, labelWidth, 1);
    if (bottomLane !== null) return { order, placement: "bottom", lane: bottomLane };
    const insideLane = findOpenLane("inside", order.time, labelWidth, Number.POSITIVE_INFINITY)!;
    return { order, placement: "inside", lane: insideLane };
  });
}

// Defined outside component — no components created during render
function ZoomGroup({
  label,
  axis,
  onZoom,
}: {
  label: string;
  axis: "x" | "y1" | "y2";
  onZoom: (axis: "x" | "y1" | "y2", dir: "in" | "out") => void;
}) {
  return (
    <div className="bg-muted/60 flex items-center gap-0.5 rounded-md px-1.5 py-0.5">
      <span className="text-muted-foreground mr-1 min-w-[20px] text-center text-[10px] font-semibold">{label}</span>
      <button type="button" onClick={() => onZoom(axis, "in")} aria-label={`Zoom in ${label}`}
        className="hover:bg-primary/20 hover:text-primary flex size-4 items-center justify-center rounded text-xs font-bold transition-colors">
        +
      </button>
      <button type="button" onClick={() => onZoom(axis, "out")} aria-label={`Zoom out ${label}`}
        className="hover:bg-primary/20 hover:text-primary flex size-4 items-center justify-center rounded text-xs font-bold transition-colors">
        −
      </button>
    </div>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

// Imperative handle exposed to PlotsArea for report/PDF export — lets the
// export orchestrator (outside this component) reuse the exact same
// FFT/decimation/timeline-aware figure builder the PNG export button uses,
// without duplicating that logic.
export interface PlotExportHandle {
  plotId: string;
  title: string;
  hasTraces: boolean;
  // exportHeight: target render canvas height in px — legend/title spacing
  // is tuned relative to it (see plotlyTheme.ts). Defaults to 1600, matching
  // the single-plot PNG export button.
  getExportFigure: (exportHeight?: number) => { data: Plotly.Data[]; layout: Partial<Plotly.Layout> } | null;
}

interface PlotWrapperProps { plot: PlotState }

const PlotWrapper = forwardRef<PlotExportHandle, PlotWrapperProps>(({ plot }, ref) => {
  // Only the signals this plot actually uses — resolved from the shared
  // studioFiles/studioOperations/studioTransforms Maps via useShallow, so an
  // unrelated edit elsewhere (another plot's signal, a new file) doesn't
  // invalidate this component just because those Maps got a new reference.
  const resolvedSignals = useStore(
    useShallow((s) => plot.signals.map((sig) => getSignal(sig.signalId, s))),
  );
  const fftSampleRateOverride = useStore((s) => s.fftSampleRateOverride);
  const adjData = useStore((s) => s.adjData);
  const orders = useStore((s) => s.orders);
  const removeStudioPlot = useStore((s) => s.removeStudioPlot);
  const renameStudioPlot = useStore((s) => s.renameStudioPlot);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const toggleStudioPlotFFT = useStore((s) => s.toggleStudioPlotFFT);
  const toggleStudioPlotLocked = useStore((s) => s.toggleStudioPlotLocked);
  const locked = !!plot.locked;

  const chartRef     = useRef<PlotlyChartHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotHeight, setPlotHeight] = useState(500);
  const [showStats, setShowStats]   = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  // Current X-axis viewport, tracked (debounced) from Plotly relayout events.
  // Drives both zoom-adaptive decimation (traces useMemo) and the Stats panel.
  const [visibleRange, setVisibleRange] = useState<[number, number] | null>(null);

  // Drop target for signals dragged from the left Series sidebar — assignment
  // itself happens centrally in useSignalDnd's handleDragEnd (AppLayout.tsx).
  // Disabled while locked, so a stray drag can't assign a signal by mistake.
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: plot.id, disabled: locked });

  // Inline rename
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName]     = useState(plot.name);

  const startRename = () => { if (locked) return; setDraftName(plot.name); setEditingName(true); };
  const commitRename = () => {
    const t = draftName.trim();
    if (t && t !== plot.name) renameStudioPlot(plot.id, t);
    setEditingName(false);
  };

  const hasLeftAxis  = plot.signals.some((s) => s.yAxis === "left");
  const hasRightAxis = plot.signals.some((s) => s.yAxis === "right");
  const hasFFT       = plot.showFFT;
  const signalCount  = plot.signals.length;

  // No manual toggle — a plot automatically becomes a "Cronograma" (Gantt
  // state timeline) the moment its first assigned signal is enum/boolean.
  // ADJ type metadata, when present, is authoritative (a known "float32"
  // signal must never fall through to the data heuristic below, or a
  // slowly-changing/quantized float gets misread as discrete). The data
  // heuristic only kicks in for signals with NO ADJ metadata at all — plain
  // CSV files loaded directly into Plot Studio. Later signals just adopt
  // whatever shape the first signal set. FFT is an explicit user toggle and
  // takes precedence if both would otherwise apply.
  const firstSignal = plot.signals[0];
  const hasTimeline = useMemo(() => {
    if (hasFFT || !firstSignal) return false;
    if (getSignalType(adjData, firstSignal.signalId) !== undefined) {
      return isDiscreteMeasurement(adjData, firstSignal.signalId);
    }
    const data = resolvedSignals[0]?.data;
    return !!data && isDiscreteSeries(data);
  }, [hasFFT, firstSignal, adjData, resolvedSignals]);

  // Units are only meaningful in time-domain mode — an FFT'd plot shows
  // magnitude, not any signal's source unit.
  const axisUnits = useMemo(() => {
    if (hasFFT) return { left: undefined, right: undefined, leftMismatch: false, rightMismatch: false };
    const leftList  = plot.signals.filter((s) => s.yAxis === "left").map((s) => getSignalUnits(adjData, s.signalId));
    const rightList = plot.signals.filter((s) => s.yAxis === "right").map((s) => getSignalUnits(adjData, s.signalId));
    return {
      left: commonUnits(leftList),
      right: commonUnits(rightList),
      leftMismatch: unitsMismatch(leftList),
      rightMismatch: unitsMismatch(rightList),
    };
  }, [plot.signals, adjData, hasFFT]);
  const hasUnitsMismatch = axisUnits.leftMismatch || axisUnits.rightMismatch;

  const getVisibleRange = useCallback((): [number, number] | null => {
    const div = chartRef.current?.getDiv();
    if (!div) return null;
    const gd = div as unknown as Plotly.PlotlyHTMLElement & { _fullLayout: Record<string, { range?: number[] }> };
    const range = gd._fullLayout["xaxis"]?.range;
    if (!range || range.length < 2) return null;
    return [Math.min(range[0], range[1]), Math.max(range[0], range[1])];
  }, []);

  // Row label per signal, top-to-bottom in assignment order — shared between
  // the timeline traces below and buildTimelineLayout's categorical y-axis.
  const timelineRowLabels = useMemo(
    () =>
      plot.signals.map((sig, idx) => {
        const signal = resolvedSignals[idx];
        return getSignalName(adjData, sig.signalId) ?? displayName(signal?.name ?? sig.signalId);
      }),
    [plot.signals, resolvedSignals, adjData],
  );

  const timelineTraces = useMemo<Plotly.Data[]>(() => {
    if (!hasTimeline) return [];
    // One flat list of segments across every signal, tagged with its row
    // label and the label to show for its state value (per-signal enum
    // lookup, since two signals could give different meanings to the same
    // numeric code).
    const allSegments: { row: string; start: number; end: number; value: number; label: string; hoverText: string }[] = [];
    plot.signals.forEach((sig, idx) => {
      const data = resolvedSignals[idx]?.data;
      if (!data || data.value.length < 1) return;
      const enumLabels = getEnumLabels(adjData, sig.signalId);
      const row = timelineRowLabels[idx];
      for (const seg of computeStateSegments(data)) {
        const label = stateLabel(seg.value, enumLabels);
        allSegments.push({
          row, start: seg.start, end: seg.end, value: seg.value, label,
          hoverText: `${label} (${seg.start.toFixed(0)} – ${seg.end.toFixed(0)} ms)`,
        });
      }
    });

    // Group into one bar trace per unique state value so each state gets a
    // single legend entry spanning every signal's row.
    const uniqueValues = [...new Set(allSegments.map((s) => s.value))].sort((a, b) => a - b);
    return uniqueValues.map((value, colorIdx) => {
      const segs = allSegments.filter((s) => s.value === value);
      return {
        type: "bar" as const,
        orientation: "h" as const,
        base: segs.map((s) => s.start),
        x: segs.map((s) => s.end - s.start),
        y: segs.map((s) => s.row),
        text: segs.map((s) => s.hoverText),
        name: segs[0].label,
        marker: { color: traceColor(colorIdx) },
        hovertemplate: "%{y}<br>%{text}<extra></extra>",
      };
    });
  }, [hasTimeline, plot.signals, resolvedSignals, adjData, timelineRowLabels]);

  const traces = useMemo<Plotly.Data[]>(
    () => {
      if (hasTimeline) return timelineTraces;
      const signalTraces: Plotly.Data[] = plot.signals.flatMap((sig, idx) => {
        const signal = resolvedSignals[idx];
        const data = signal?.data;
        if (!data || data.value.length < 2) return [];
        let name = getSignalName(adjData, sig.signalId) ?? displayName(signal?.name ?? sig.signalId);
        const color = resolveSignalColor(sig.color, sig.colorIndex);
        const isRight = sig.yAxis === "right";
        // Right-axis traces are dashed so axis membership reads at a glance,
        // independent of how many colors are in play (color alone doesn't
        // scale as a left/right cue once there are more than two traces).
        const dash: Plotly.Dash = isRight ? "dash" : "solid";
        // Axis title can't show a unit when signals on it disagree — put each
        // signal's own unit in the legend instead so it's still visible.
        const axisMismatch = isRight ? axisUnits.rightMismatch : axisUnits.leftMismatch;
        if (axisMismatch && !hasFFT) {
          const unit = getSignalUnits(adjData, sig.signalId);
          if (unit) name = `${name} (${unit})`;
        }

        let xArr: Float64Array;
        let yArr: Float64Array;
        if (hasFFT) {
          const fftResult = computeFFT(data, fftSampleRateOverride);
          xArr = fftResult.frequency;
          yArr = fftResult.magnitude;
        } else {
          xArr = data.time;
          yArr = data.value;
        }

        // Slice to the current zoom window, then decimate for rendering.
        // Always SVG scatter, never scattergl — decimation already bounds
        // the point count sent to Plotly, so WebGL's raw point-count
        // headroom brings nothing, and this user's environment can't
        // sustain a WebGL context at all (immediate "context was lost").
        let sliceStart = 0;
        let sliceEnd = xArr.length;
        if (visibleRange) {
          sliceStart = lowerBound(xArr, visibleRange[0]);
          sliceEnd = upperBound(xArr, visibleRange[1]);
        }

        let renderX = xArr.subarray(sliceStart, sliceEnd);
        let renderY = yArr.subarray(sliceStart, sliceEnd);
        if (renderX.length > DECIMATE_THRESHOLD) {
          const decimated = decimateLTTB(renderX, renderY, DECIMATE_THRESHOLD);
          renderX = decimated.time;
          renderY = decimated.value;
        }

        const traceType = "scatter" as const;

        if (hasFFT) {
          return [{
            x: renderX, y: renderY,
            type: traceType,
            mode: "lines" as const,
            name: `${name} (FFT)`, line: { width: 2, color, dash },
            yaxis: isRight ? ("y2" as const) : ("y" as const),
          }];
        }
        return [{
          x: renderX, y: renderY,
          type: traceType,
          mode: "lines" as const,
          name, line: { width: 2.5, color, dash },
          yaxis: isRight ? ("y2" as const) : ("y" as const),
        }];
      });

      // If every trace ended up on the right (secondary) axis, the primary
      // "y" axis has nothing plotted against it — Plotly doesn't draw an
      // axis's line/border at all when it has zero traces, which otherwise
      // makes the plot's left border vanish. A fully invisible dummy trace
      // keeps "y" registered as in-use so its border still renders, without
      // moving the real signal off the right axis the user chose for it.
      if (hasRightAxis && !hasLeftAxis && signalTraces.length > 0) {
        signalTraces.push({
          x: [], y: [],
          type: "scatter" as const,
          mode: "markers" as const,
          yaxis: "y" as const,
          showlegend: false,
          hoverinfo: "skip" as const,
        });
      }

      return signalTraces;
    },
    [plot.signals, resolvedSignals, fftSampleRateOverride, adjData, axisUnits, hasFFT, hasLeftAxis, hasRightAxis, hasTimeline, timelineTraces, visibleRange],
  );

  const hasTraces = traces.length > 0;

  // Orders share the session timebase with telemetry. Render them as paper-
  // height vertical event lines so they remain meaningful for plots with any
  // unit (and for the categorical timeline). FFT uses frequency, so order
  // timestamps intentionally do not appear in that mode.
  const visibleOrders = useMemo(
    () => !hasFFT ? orders.filter((order) => !plot.hiddenOrderIds?.[order.id]) : [],
    [orders, plot.hiddenOrderIds, hasFFT],
  );
  const orderLabelLanes = useMemo(() => assignOrderLabelLanes(visibleOrders), [visibleOrders]);

  const addOrderAnnotations = useCallback((baseLayout: Partial<Plotly.Layout>) => {
    if (orderLabelLanes.length === 0) return baseLayout;
    const theme = getPlotlyTheme(isDarkMode);
    return {
      ...baseLayout,
      shapes: [
        ...(baseLayout.shapes ?? []),
        ...orderLabelLanes.map(({ order }) => ({
          type: "line" as const,
          xref: "x" as const, yref: "paper" as const,
          x0: order.time, x1: order.time, y0: 0, y1: 1,
          line: { color: ORDER_EVENT_COLOR, width: 1.25, dash: "dot" as const },
          layer: "above" as const,
        })),
      ],
      annotations: [
        ...(baseLayout.annotations ?? []),
        ...orderLabelLanes.map(({ order, placement, lane }) => ({
          x: order.time, xref: "x" as const,
          // Keep the first lane just inside the plot. Placing it in the top
          // margin makes it overlap Plotly's editable chart title.
          y: placement === "bottom" ? 0 : 1, yref: "paper" as const,
          text: formatOrderAnnotation(order.name, order.parameters),
          showarrow: false,
          xanchor: "left" as const,
          yanchor: "top" as const,
          xshift: 3,
          yshift: placement === "bottom" ? -5 : -6 - lane * 32,
          font: { size: 10, color: theme.fontColor },
          bgcolor: theme.paperBg,
          bordercolor: ORDER_EVENT_COLOR,
          borderwidth: 1,
          opacity: 0.94,
          align: "left" as const,
        })),
      ],
    };
  }, [orderLabelLanes, isDarkMode]);

  const layout = useMemo<Partial<Plotly.Layout>>(
    () => addOrderAnnotations(
      hasTimeline
        ? buildTimelineLayout({ theme: getPlotlyTheme(isDarkMode), plotId: plot.id, rowLabels: timelineRowLabels, locked })
        : buildPlotLayout({
            theme: getPlotlyTheme(isDarkMode),
            hasFFT, hasLeftAxis, hasRightAxis, plotId: plot.id,
            leftUnits: axisUnits.left, rightUnits: axisUnits.right,
            locked,
          }),
    ),
    [hasLeftAxis, hasRightAxis, hasFFT, hasTimeline, timelineRowLabels, plot.id, axisUnits, isDarkMode, locked, addOrderAnnotations],
  );

  // editable (click-to-rename title/legend) is the one PLOTLY_CONFIG option
  // that isn't axis-scoped (fixedrange, set via `layout` above, already
  // blocks pan/zoom/scroll-zoom/box-zoom while locked) — gated separately here.
  const plotlyConfig = useMemo<Partial<Plotly.Config>>(
    () => ({ ...PLOTLY_CONFIG, editable: !locked }),
    [locked],
  );

  // Drag-to-resize
  const isResizing  = useRef(false);
  const startY      = useRef(0);
  const startHeight = useRef(0);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    isResizing.current  = true;
    startY.current      = e.clientY;
    startHeight.current = containerRef.current?.offsetHeight ?? plotHeight;
    e.preventDefault();
  }, [plotHeight, locked]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setPlotHeight(Math.max(300, startHeight.current + (e.clientY - startY.current)));
    };
    const onUp = () => { isResizing.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Track the visible X range whenever the user zooms/pans, so decimation and
  // the Stats panel both track the current viewport live. Debounced — relayout
  // fires many times/sec during a drag, and recomputing on every tick is what
  // made interaction janky/unresponsive. Runs regardless of whether Stats is
  // open, since decimation needs this too.
  useEffect(() => {
    if (!hasTraces) return;
    const div = chartRef.current?.getDiv() as PlotlyEventDiv | null | undefined;
    if (!div?.on) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVisibleRange(getVisibleRange()), 200);
    };
    div.on("plotly_relayout", handler);
    return () => {
      if (timer) clearTimeout(timer);
      div.removeAllListeners?.("plotly_relayout");
    };
  }, [hasTraces, getVisibleRange]);

  // Time (ms) and frequency (Hz) are unrelated axes — a range captured in one
  // mode must not be reused to slice the other after toggling FFT. Plotly's
  // own uirevision-driven zoom reset on mode switch is an internal `react()`
  // reconciliation, not a user interaction, so it never fires plotly_relayout.
  // Reset during render (not an effect) per React's "adjusting state when a
  // prop changes" pattern — avoids an extra cascading render.
  const [prevHasFFT, setPrevHasFFT] = useState(hasFFT);
  if (prevHasFFT !== hasFFT) {
    setPrevHasFFT(hasFFT);
    setVisibleRange(null);
  }

  const zoomAxis = useCallback((axis: "x" | "y1" | "y2", direction: "in" | "out") => {
    const div = chartRef.current?.getDiv();
    if (!div) return;
    const gd = div as unknown as Plotly.PlotlyHTMLElement & { _fullLayout: Record<string, { range?: number[] }> };
    const factor   = direction === "in" ? 0.7 : 1.4;
    const axisKey  = axis === "x" ? "xaxis" : axis === "y1" ? "yaxis" : "yaxis2";
    const rangeKey = axis === "x" ? "xaxis.range" : axis === "y1" ? "yaxis.range" : "yaxis2.range";
    const range = gd._fullLayout[axisKey]?.range;
    if (!range) return;
    const center = (range[0] + range[1]) / 2;
    const half   = ((range[1] - range[0]) / 2) * factor;
    Plotly.relayout(div, { [rangeKey]: [center - half, center + half] });
  }, []);

  const resetZoom = useCallback(() => {
    const div = chartRef.current?.getDiv();
    if (!div) return;
    Plotly.relayout(div, { "xaxis.autorange": true, "yaxis.autorange": true, "yaxis2.autorange": true } as Partial<Plotly.Layout>);
  }, []);

  // Exports always render in the light/academic theme regardless of the
  // on-screen app theme (publication-figure look), but keep whatever
  // zoom/pan range is currently visible rather than autoranging to all data.
  const buildExportFigure = (exportHeight = 1600) => {
    const div = chartRef.current?.getDiv();
    if (!div) return null;
    const gd = div as unknown as Plotly.PlotlyHTMLElement & { _fullLayout: Record<string, { range?: number[] }> };
    let exportLayout = hasTimeline
      ? buildTimelineLayout({ theme: getPlotlyTheme(false), plotId: plot.id, rowLabels: timelineRowLabels, fontScale: 1.8, exportHeight })
      : buildPlotLayout({
          theme: getPlotlyTheme(false),
          hasFFT, hasLeftAxis, hasRightAxis, plotId: plot.id,
          leftUnits: axisUnits.left, rightUnits: axisUnits.right,
          fontScale: 1.8, exportHeight,
        });
    // Export is always light, so rebuild annotations with its print theme.
    if (orderLabelLanes.length > 0) {
      const printTheme = getPlotlyTheme(false);
      exportLayout = {
        ...exportLayout,
        shapes: [...(exportLayout.shapes ?? []), ...orderLabelLanes.map(({ order }) => ({
          type: "line" as const, xref: "x" as const, yref: "paper" as const,
          x0: order.time, x1: order.time, y0: 0, y1: 1,
          line: { color: ORDER_EVENT_COLOR, width: 2, dash: "dot" as const }, layer: "above" as const,
        }))],
        annotations: [...(exportLayout.annotations ?? []), ...orderLabelLanes.map(({ order, placement, lane }) => ({
          x: order.time, xref: "x" as const,
          y: placement === "bottom" ? 0 : 1, yref: "paper" as const,
          text: formatOrderAnnotation(order.name, order.parameters),
          showarrow: false, xanchor: "left" as const,
          yanchor: "top" as const,
          xshift: 5,
          yshift: placement === "bottom" ? -8 : -10 - lane * 56,
          font: { size: 18, color: printTheme.fontColor },
          bgcolor: printTheme.paperBg, bordercolor: ORDER_EVENT_COLOR, borderwidth: 1.5, align: "left" as const,
        }))],
      };
    }
    // Carry over whatever title the user typed via Plotly's click-to-edit —
    // gd.layout is Plotly's live, mutated layout (relayout writes
    // title.text into it), whereas exportLayout is rebuilt fresh from
    // buildPlotLayout and starts blank.
    const liveTitle = gd.layout?.title;
    const liveTitleText = typeof liveTitle === "object" ? liveTitle?.text : liveTitle;
    if (liveTitleText) exportLayout.title = { ...exportLayout.title, text: liveTitleText };

    // The y-axis is categorical in timeline mode — only the x (time) range
    // carries over, copying a numeric range onto a category axis would break it.
    const xRange = gd._fullLayout["xaxis"]?.range;
    if (xRange) exportLayout.xaxis = { ...exportLayout.xaxis, range: xRange, autorange: false };
    if (!hasTimeline) {
      const yRange  = gd._fullLayout["yaxis"]?.range;
      const y2Range = gd._fullLayout["yaxis2"]?.range;
      if (yRange) exportLayout.yaxis = { ...exportLayout.yaxis, range: yRange, autorange: false };
      if (y2Range && exportLayout.yaxis2) exportLayout.yaxis2 = { ...exportLayout.yaxis2, range: y2Range, autorange: false };
    }

    // Team branding watermark, bottom-right corner — export-only (not shown
    // on the live/on-screen chart). Paper coords span the whole canvas
    // (margins included), so x:1/y:0 with right/bottom anchors is the true
    // image corner. ~260px square on the 2400x1600 export canvas.
    exportLayout.images = [{
      source: logoIcon,
      xref: "paper", yref: "paper",
      x: 0.99, y: 0.015,
      xanchor: "right", yanchor: "bottom",
      sizex: 0.11, sizey: 0.165,
      opacity: 1,
      layer: "above",
    }];

    return { data: gd.data, layout: exportLayout };
  };

  useImperativeHandle(ref, () => ({
    plotId: plot.id,
    title: plot.name,
    hasTraces,
    getExportFigure: buildExportFigure,
  }));

  const exportPNG = () => {
    const figure = buildExportFigure();
    if (!figure) return;
    // downloadImage's types don't expose `scale` (DownloadImgopts lacks it,
    // unlike ToImgopts) even though Plotly supports it at runtime — go
    // through toImage + a manual anchor download instead, matching the
    // pattern the SVG export used before it was removed.
    Plotly.toImage(figure, { format: "png", width: 2400, height: 1600, scale: 4 }).then((url) => {
      const a = document.createElement("a");
      a.href = url; a.download = `${plot.name}__${exportTimestamp()}.png`; a.click();
    });
  };

  const statsData = useMemo(
    () => plot.signals.map((sig, idx) => {
      const signal = resolvedSignals[idx];
      const data = signal?.data ?? null;
      const name = getSignalName(adjData, sig.signalId) ?? displayName(signal?.name ?? sig.signalId);
      return { signalId: sig.signalId, name, data, color: resolveSignalColor(sig.color, idx) };
    }),
    [plot.signals, resolvedSignals, adjData],
  );

  return (
    <ContextMenu>
    <ContextMenuTrigger asChild>
    <div
      id={plot.id}
      ref={setDropRef}
      className={cn(
        "bg-card overflow-hidden rounded-xl border shadow-md transition-shadow hover:shadow-lg",
        isOver && "ring-primary ring-2 ring-offset-2",
        locked && "ring-1 ring-amber-500/40",
      )}
    >
      {/* Gradient accent strip */}
      <div className="from-primary/80 to-primary/20 h-[3px] bg-gradient-to-r" />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
        <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand plot" : "Collapse plot"}
          className="text-muted-foreground hover:text-foreground hover:bg-muted -ml-1.5 shrink-0">
          <ChevronDown className={`size-5 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <Activity className="text-primary size-4 shrink-0" />

          {editingName ? (
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="h-6 w-44 px-2 text-sm shadow-none"
              aria-label="Plot name"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={startRename}
              className="group/name flex min-w-0 items-center gap-1.5"
              title={locked ? undefined : "Double-click to rename"}
            >
              <span className="text-foreground truncate text-sm font-semibold">{plot.name}</span>
              {!locked && (
                <Pencil
                  onClick={startRename}
                  className="text-muted-foreground size-3 shrink-0 cursor-pointer opacity-0 transition-opacity hover:!opacity-100 group-hover/name:opacity-60"
                />
              )}
            </button>
          )}

          {signalCount > 0 && (
            <span className="bg-primary/15 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
              {signalCount} signal{signalCount !== 1 ? "s" : ""}
            </span>
          )}

          {hasUnitsMismatch && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="size-3" />
                  Units mismatch
                </span>
              </TooltipTrigger>
              <TooltipContent>Signals sharing an axis have different units — the axis title omits units</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Zoom cluster — only meaningful with traces, and hidden while
              locked since the axes are fixedrange (see `layout` above) and
              these buttons would otherwise bypass that via direct relayout calls. */}
          {hasTraces && !locked && (
            <div className="bg-muted/40 flex items-center gap-1 rounded-lg border px-1.5 py-1">
              {/* Categorical y-axis in timeline mode isn't zoomable the same way — X (time) still is. */}
              {!hasTimeline && hasLeftAxis && <ZoomGroup label="Y◀" axis="y1" onZoom={zoomAxis} />}
              {!hasTimeline && hasRightAxis && <ZoomGroup label="Y▶" axis="y2" onZoom={zoomAxis} />}
              <ZoomGroup label="X" axis="x" onZoom={zoomAxis} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" onClick={resetZoom} aria-label="Reset zoom"
                    className="text-muted-foreground hover:text-primary size-5">
                    <RefreshCw className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset zoom</TooltipContent>
              </Tooltip>
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={locked ? "default" : "ghost"}
                size="icon-xs"
                onClick={() => toggleStudioPlotLocked(plot.id)}
                aria-label={locked ? `Unlock ${plot.name}` : `Lock ${plot.name}`}
                className={cn(
                  !locked && "text-muted-foreground hover:text-foreground",
                  locked && "bg-amber-500/90 text-white hover:bg-amber-500",
                )}
              >
                {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locked ? "Locked — view can't be changed by accident. Click to unlock" : "Lock plot"}
            </TooltipContent>
          </Tooltip>

          <Button
            variant={showStats ? "default" : "outline"}
            size="xs"
            onClick={() => setShowStats((v) => !v)}
            disabled={!hasTraces || hasTimeline}
            className="gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
            Stats
          </Button>

          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={exportPNG} disabled={!hasTraces}
                  aria-label="Export PNG" className="text-muted-foreground hover:text-foreground">
                  <IconDownload />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export PNG</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={() => removeStudioPlot(plot.id)}
                aria-label="Close plot"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close plot</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Kept mounted (not conditionally removed) while collapsed, so Plotly's
          zoom/pan state and WebGL context survive expand/collapse. */}
      <div className={collapsed ? "hidden" : undefined}>
        {hasTraces ? (
          // Chart canvas follows app dark mode; exports stay pinned to the
          // light/academic theme regardless (see buildExportFigure above).
          <div ref={containerRef} className="relative" style={{ height: plotHeight, backgroundColor: isDarkMode ? "#181818" : "white" }}>
            <PlotlyChart ref={chartRef} traces={traces} layout={layout} config={plotlyConfig} style={{ height: "100%" }} />
            {!locked && (
              <div
                onMouseDown={onResizeMouseDown}
                className="hover:bg-primary/10 group absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-center justify-center"
              >
                <div className="bg-border group-hover:bg-primary/50 h-0.5 w-12 rounded-full transition-colors" />
              </div>
            )}
          </div>
        ) : (
          <div className="border-muted-foreground/20 bg-muted/20 m-4 mt-1 flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
            <Activity className="text-muted-foreground/40 size-6" />
            <p className="text-muted-foreground text-xs">
              No signals to display — assign one from the <span className="text-foreground font-medium">Plots</span> panel
            </p>
          </div>
        )}

        {showStats && hasTraces && !hasTimeline && (
          <StatsPanel signalData={statsData} visibleRange={visibleRange} onClose={() => setShowStats(false)} />
        )}
      </div>
    </div>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onClick={startRename} disabled={locked}>
        <Pencil className="size-3.5" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem onClick={() => toggleStudioPlotLocked(plot.id)}>
        {locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
        {locked ? "Unlock" : "Lock"}
      </ContextMenuItem>
      <ContextMenuCheckboxItem checked={plot.showFFT} onCheckedChange={() => toggleStudioPlotFFT(plot.id)}>
        Frequency spectrum (FFT)
      </ContextMenuCheckboxItem>
      <ContextMenuItem onClick={() => setCollapsed((v) => !v)}>
        <ChevronDown className={`size-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        {collapsed ? "Expand" : "Collapse"}
      </ContextMenuItem>
      <ContextMenuItem onClick={resetZoom} disabled={!hasTraces || locked}>
        <RefreshCw className="size-3.5" />
        Reset Zoom
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuCheckboxItem checked={showStats} onCheckedChange={() => setShowStats((v) => !v)} disabled={!hasTraces || hasTimeline}>
        Show Stats
      </ContextMenuCheckboxItem>
      <ContextMenuItem onClick={exportPNG} disabled={!hasTraces}>
        <IconDownload />
        Export PNG
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={() => removeStudioPlot(plot.id)}>
        <Trash2 className="size-3.5" />
        Close
      </ContextMenuItem>
    </ContextMenuContent>
    </ContextMenu>
  );
});

PlotWrapper.displayName = "PlotWrapper";
export default memo(PlotWrapper);
