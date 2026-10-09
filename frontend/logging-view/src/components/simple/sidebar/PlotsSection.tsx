// Plot management: create plots, assign any session series (parsed lazily on
// first use) and configure each signal's Y axis. FFT is a whole-plot toggle
// (not per-signal) — mixing FFT and time-domain traces on one plot would mean
// two incompatible X-axis semantics sharing one axis. The color dot on each
// chip matches the trace color in the chart (lib/plotStudio/palette).
import {
  Button,
  Checkbox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components";
import { Activity, ChevronDown, Eye, EyeOff, GripVertical, Plus, Send, Trash2, X } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { resolveSignalColor } from "../../../lib/plotStudio/palette";
import { getSignalName } from "../../../lib/plotStudio/units";
import { formatOrderParameters } from "../../../lib/orders";
import { getSignal } from "../../../store/slices/plotStudioSlice";
import { useStore } from "../../../store/store";
import { useSignalLoader } from "../hooks/useStudioSignals";
import SignalSelect from "../SignalSelect";

export default function PlotsSection() {
  const studioPlots      = useStore((s) => s.studioPlots);
  const adjData = useStore((s) => s.adjData);
  // Display names only, keyed by signalId — not the full signal objects (with
  // their data arrays) — so this list only re-renders when a name assigned to
  // one of *these* signals actually changes, not on every unrelated file/
  // operation/transform mutation elsewhere in the store.
  const signalNames = useStore(
    useShallow((s) => {
      const names: Record<string, string> = {};
      s.studioPlots.forEach((p) => p.signals.forEach((sig) => {
        if (names[sig.signalId] !== undefined) return;
        names[sig.signalId] = getSignal(sig.signalId, s)?.name ?? sig.signalId;
      }));
      return names;
    }),
  );
  const addStudioPlot              = useStore((s) => s.addStudioPlot);
  const removeStudioPlot           = useStore((s) => s.removeStudioPlot);
  const toggleStudioPlotHidden     = useStore((s) => s.toggleStudioPlotHidden);
  const reorderStudioPlots         = useStore((s) => s.reorderStudioPlots);
  const addSignalToStudioPlot      = useStore((s) => s.addSignalToStudioPlot);
  const removeSignalFromStudioPlot = useStore((s) => s.removeSignalFromStudioPlot);
  const updateStudioSignalAxis     = useStore((s) => s.updateStudioSignalAxis);
  const toggleStudioPlotFFT        = useStore((s) => s.toggleStudioPlotFFT);
  const updateStudioSignalColor    = useStore((s) => s.updateStudioSignalColor);
  const orders                      = useStore((s) => s.orders);
  const toggleStudioPlotOrder       = useStore((s) => s.toggleStudioPlotOrder);
  const setStudioPlotOrdersVisible  = useStore((s) => s.setStudioPlotOrdersVisible);

  const ensureLoaded = useSignalLoader();
  // Plot ids with a CSV parse in flight (shows "Loading…" in the trigger)
  const [assigning, setAssigning] = useState<Set<string>>(new Set());
  // Drag-to-reorder: id of the plot currently being dragged
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Order lists can be long, so let each plot keep its own collapsed state.
  const [collapsedOrderSections, setCollapsedOrderSections] = useState<Set<string>>(new Set());

  const plots = Array.from(studioPlots.values());

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const ids = plots.map((p) => p.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderStudioPlots(ids);
    setDraggingId(null);
  };

  const shortName = (id: string) =>
    id.includes("/") ? id.split("/").slice(1).join("/") : id.replace(/\.csv$/, "");

  // Jump to a plot's card in the main PlotsArea — mirrors PlotWrapper's
  // `id={plot.id}` on its outer card so this is a plain in-page anchor.
  const scrollToPlot = (plotId: string) => {
    document.getElementById(plotId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const assign = async (plotId: string, signalId: string) => {
    setAssigning((prev) => new Set(prev).add(plotId));
    try {
      const data = await ensureLoaded(signalId);
      if (data) addSignalToStudioPlot(plotId, signalId);
    } finally {
      setAssigning((prev) => { const next = new Set(prev); next.delete(plotId); return next; });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button size="sm" className="w-full" onClick={addStudioPlot}>
        <Plus className="mr-1 size-3.5" />
        Add New Plot
      </Button>

      {plots.length === 0 && (
        <p className="text-muted-foreground py-2 text-center text-[11px]">
          Create a plot, then assign any session series to it
        </p>
      )}

      {plots.map((plot) => (
        <div key={plot.id}
          className={cn(
            "bg-card overflow-hidden rounded-lg border shadow-sm transition-opacity",
            plot.hidden && "opacity-50",
            draggingId === plot.id && "opacity-30",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(plot.id)}
        >
          {/* Plot header — draggable to reorder plots (reflected in PlotsArea too) */}
          <div
            draggable
            onDragStart={() => setDraggingId(plot.id)}
            onDragEnd={() => setDraggingId(null)}
            className="from-primary/5 flex cursor-grab items-center gap-2 border-b bg-gradient-to-r to-transparent px-3 py-2 active:cursor-grabbing"
          >
            <GripVertical className="text-muted-foreground/50 size-3.5 shrink-0" />
            <div className="bg-primary/20 flex size-4 shrink-0 items-center justify-center rounded-sm">
              <Activity className="text-primary size-3" />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => scrollToPlot(plot.id)}
                  className="text-foreground hover:text-primary min-w-0 flex-1 truncate text-left text-xs font-semibold hover:underline"
                >
                  {plot.name}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Jump to plot</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="text-muted-foreground hover:text-foreground flex shrink-0 cursor-pointer items-center gap-1 text-[10px] transition-colors">
                  <input
                    type="checkbox"
                    checked={plot.showFFT}
                    onChange={() => toggleStudioPlotFFT(plot.id)}
                    className="accent-primary size-3"
                  />
                  FFT
                </label>
              </TooltipTrigger>
              <TooltipContent side="left">
                {plot.showFFT ? "Showing frequency spectrum" : "Showing time-domain"} — applies to every signal in this plot
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs"
                  onClick={() => toggleStudioPlotHidden(plot.id)}
                  aria-label={plot.hidden ? `Show ${plot.name}` : `Hide ${plot.name}`}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted">
                  {plot.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{plot.hidden ? "Show plot" : "Hide plot"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs"
                  onClick={() => removeStudioPlot(plot.id)}
                  aria-label={`Close ${plot.name}`}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Close plot</TooltipContent>
            </Tooltip>
          </div>

          {/* Assigned signals — grouped by axis so left/right membership is
              obvious from list position, not just a small per-row dropdown. */}
          {plot.signals.length > 0 && (
            <div className="flex flex-col gap-2 px-2 py-2">
              {(["left", "right"] as const).map((axis) => {
                const axisSignals = plot.signals.filter((sig) => sig.yAxis === axis);
                if (axisSignals.length === 0) return null;
                return (
                  <div key={axis} className="flex flex-col gap-1">
                    <span className="text-muted-foreground px-0.5 text-[10px] font-semibold tracking-wide">
                      {axis === "left" ? "◀ Left axis" : "Right axis ▶"}
                    </span>
                    {axisSignals.map((sig) => {
                      // Ref to the hidden-ish color input, so the context menu's
                      // "Change Color" item can open the same native picker.
                      let colorInputEl: HTMLInputElement | null = null;
                      return (
                        <ContextMenu key={sig.signalId}>
                          <ContextMenuTrigger asChild>
                        <div
                          className="bg-muted/30 hover:bg-muted/60 group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors">
                          {/* Trace color — click to override; matches the curve in the chart */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Label wrapper enlarges the click target well beyond the
                                  tiny visible dot, without changing its visual size. */}
                              <label className="-m-1.5 shrink-0 cursor-pointer p-1.5">
                                <input
                                  ref={(el) => { colorInputEl = el; }}
                                  type="color"
                                  value={resolveSignalColor(sig.color, sig.colorIndex)}
                                  onChange={(e) => updateStudioSignalColor(plot.id, sig.signalId, e.target.value)}
                                  aria-label="Signal color"
                                  className="size-2.5 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                                />
                              </label>
                            </TooltipTrigger>
                            <TooltipContent side="left">Signal color</TooltipContent>
                          </Tooltip>
                          <span className="text-foreground min-w-0 flex-1 truncate text-[11px] font-medium">
                            {getSignalName(adjData, sig.signalId) ?? shortName(signalNames[sig.signalId] ?? sig.signalId)}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Select
                              value={sig.yAxis}
                              onValueChange={(v) => updateStudioSignalAxis(plot.id, sig.signalId, v as "left" | "right")}
                            >
                              <SelectTrigger size="sm" className="h-5 w-16 border-0 bg-transparent px-1 text-[10px] shadow-none focus-visible:ring-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">◀ Left</SelectItem>
                                <SelectItem value="right">Right ▶</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon-xs"
                              onClick={() => removeSignalFromStudioPlot(plot.id, sig.signalId)}
                              aria-label="Remove signal from plot"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-4 opacity-0 transition-opacity group-hover:opacity-100">
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuLabel>Axis</ContextMenuLabel>
                            <ContextMenuRadioGroup
                              value={sig.yAxis}
                              onValueChange={(v) => updateStudioSignalAxis(plot.id, sig.signalId, v as "left" | "right")}
                            >
                              <ContextMenuRadioItem value="left">Left</ContextMenuRadioItem>
                              <ContextMenuRadioItem value="right">Right</ContextMenuRadioItem>
                            </ContextMenuRadioGroup>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => colorInputEl?.click()}>
                              Change Color
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => removeSignalFromStudioPlot(plot.id, sig.signalId)}
                            >
                              <Trash2 className="size-3.5" />
                              Remove from Plot
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {orders.length > 0 && (
            <div className="border-t px-2 py-2">
              <button
                type="button"
                onClick={() => setCollapsedOrderSections((previous) => {
                  const next = new Set(previous);
                  if (next.has(plot.id)) next.delete(plot.id);
                  else next.add(plot.id);
                  return next;
                })}
                aria-expanded={!collapsedOrderSections.has(plot.id)}
                aria-controls={`${plot.id}-order-markers`}
                className="hover:bg-muted/60 flex w-full items-start gap-2 rounded-md px-0.5 py-0.5 text-left transition-colors"
              >
                <div className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm">
                  <Send className="size-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground text-[11px] font-semibold">Order markers</span>
                    <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                      {orders.filter((order) => !plot.hiddenOrderIds?.[order.id]).length}/{orders.length} shown
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[10px] leading-snug">
                    Show command events on this plot
                    {plot.showFFT && " (hidden in FFT mode)"}.
                  </p>
                </div>
                <ChevronDown className={cn(
                  "text-muted-foreground mt-1 size-3.5 shrink-0 transition-transform",
                  collapsedOrderSections.has(plot.id) && "-rotate-90",
                )} />
              </button>

              {!collapsedOrderSections.has(plot.id) && (
                <div id={`${plot.id}-order-markers`}>
                  <div className="mt-2 flex gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={plot.showFFT}
                      onClick={() => setStudioPlotOrdersVisible(plot.id, orders.map((order) => order.id), true)}
                      className="h-6 flex-1 text-[10px]"
                    >
                      Show all
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={plot.showFFT}
                      onClick={() => setStudioPlotOrdersVisible(plot.id, orders.map((order) => order.id), false)}
                      className="h-6 flex-1 text-[10px]"
                    >
                      Hide all
                    </Button>
                  </div>

                  <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-0.5">
                    {orders.map((order) => {
                      const checked = !plot.hiddenOrderIds?.[order.id];
                      return (
                        <label
                          key={order.id}
                          className={cn(
                            "bg-muted/30 hover:bg-muted/60 flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors",
                            plot.showFFT && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={plot.showFFT}
                            onCheckedChange={() => toggleStudioPlotOrder(plot.id, order.id)}
                            aria-label={`${checked ? "Hide" : "Show"} ${order.name} order marker`}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[11px] font-medium">{order.name}</span>
                              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{order.time.toFixed(0)} ms</span>
                            </span>
                            <span className="text-muted-foreground mt-0.5 block break-words text-[10px]">
                              From: <span className="text-foreground font-medium">{order.from}</span>
                              {" → "}
                              To: <span className="text-foreground font-medium">{order.to}</span>
                              {" · "}{formatOrderParameters(order.parameters)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assign dropdown — grouped by board, hides already-assigned */}
          <div className={cn("px-2 pb-2", plot.signals.length > 0 ? "border-t pt-1.5" : "pt-2")}>
            <SignalSelect
              value=""
              onValueChange={(id) => assign(plot.id, id)}
              placeholder={assigning.has(plot.id) ? "Loading…" : "+ Assign signal…"}
              exclude={plot.signals.map((s) => s.signalId)}
              size="sm"
              triggerClassName="text-muted-foreground h-7 w-full border-dashed text-[11px] shadow-none"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
