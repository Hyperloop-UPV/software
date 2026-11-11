import {
  Button,
  Checkbox,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@hyperloopupv/frontend-kit/components";
import {
  AlertTriangle,
  Columns,
  Eye,
  EyeOff,
  Grid2X2,
  Layers,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  Rows2,
  Send,
  Settings2,
  Square,
  Trash2,
  X,
} from "@hyperloopupv/frontend-kit/icons";
import { useDroppable } from "@dnd-kit/core";
import * as echarts from "echarts";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDashboardSetting } from "../../hooks/useDashboardSetting";
import { useDashboardTimeWindow } from "../../hooks/useDashboardTimeWindow";
import { useSeriesSelection } from "../../hooks/useSeriesSelection";
import { useStore } from "../../store/store";
import {
  arrangePanes,
  getPanes,
  minimumLayoutSize,
  removePane,
  splitPane,
  updatePane,
} from "../../lib/normal/layout";
import { enumVariantColor } from "../../lib/normal/enumColors";
import {
  canMixSignals,
  classifyPaneSignals,
  MIXED_ENUM_MESSAGE,
} from "../../lib/normal/enums";
import { axisKey } from "../../lib/normal/units";
import {
  TIME_DIVISORS,
  type ChartLayout,
  type ChartPane,
  type ComparisonSignal,
  type DashboardSettings,
  type NormalDashboard,
  type TimeDomain,
  type TimeRange,
  type TimeUnit,
} from "../../types/normal";
import type { LoggedOrder } from "../../types/session";
import ComparisonChart from "./ComparisonChart";
import WindowStatistics, { type StatisticsGroup } from "./WindowStatistics";

const MAX_PANES = 8;
// Same four presets the toolbar offers, for the workspace context menu.
const LAYOUT_ITEMS = [
  { value: "single", label: "Single", Icon: Square },
  { value: "columns", label: "Columns", Icon: Columns },
  { value: "rows", label: "Rows", Icon: Rows2 },
  { value: "grid", label: "Grid", Icon: Grid2X2 },
] as const;
// A window edge, as a time in display units, from its percentage of the
// recording. Shared by the pane header label and the workspace footer.
function formatWindowTime(
  percent: number,
  domain: TimeDomain,
  timeUnit: TimeUnit,
): string {
  const duration = (domain.endMs - domain.startMs) / TIME_DIVISORS[timeUnit];
  return ((duration * percent) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

interface PaneProps {
  dashboardId: string;
  locked: boolean;
  node: ChartPane;
  index: number;
  allSignals: ComparisonSignal[];
  orders: LoggedOrder[];
  showOrders: boolean;
  domain: TimeDomain;
  range: TimeRange;
  linkTimeAxis: boolean;
  enumAsBackground: boolean;
  timeUnit: TimeUnit;
  isDarkMode: boolean;
  syncGroup: string;
  canSplit: boolean;
  canClose: boolean;
  focused: boolean;
  // null puts the pane back on the dashboard window.
  onRangeChange: (paneId: string, range: TimeRange | null) => void;
  onSplit: (id: string, direction: "horizontal" | "vertical") => void;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onChange: (
    id: string,
    changes: Partial<
      Pick<
        ChartPane,
        "title" | "signalIds" | "normalized" | "hiddenSignalIds" | "enumDisplay"
      >
    >,
  ) => void;
  onUnitChange: (id: string, unit: string) => void;
}

function ComparisonPane({
  dashboardId,
  locked,
  node,
  index,
  allSignals,
  orders,
  showOrders,
  domain,
  range,
  linkTimeAxis,
  enumAsBackground,
  timeUnit,
  isDarkMode,
  syncGroup,
  canSplit,
  canClose,
  focused,
  onRangeChange,
  onSplit,
  onClose,
  onFocus,
  onChange,
  onUnitChange,
}: PaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `normal-plot:${node.id}`,
    disabled: locked,
    data: { kind: "normal-plot", dashboardId, plotId: node.id },
  });
  const signals = useMemo(
    () => allSignals.filter((signal) => node.signalIds.includes(signal.id)),
    [allSignals, node.signalIds],
  );
  const [signalQuery, setSignalQuery] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  // Set while the context menu is closing *because* it opened the config
  // popover, so the menu's focus restore does not dismiss it (see below).
  const reopenConfigRef = useRef(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const { selectedSeries } = useSeriesSelection();
  const assignSignals = useStore((state) => state.assignNormalSignalsToPlot);
  const selectedIds = useMemo(
    () => Object.keys(selectedSeries).filter((key) => selectedSeries[key]),
    [selectedSeries],
  );
  const [draftTitle, setDraftTitle] = useState(
    node.title ?? `Plot ${index + 1}`,
  );
  const visibleSignals = useMemo(
    () =>
      signals.filter((signal) => !node.hiddenSignalIds?.includes(signal.id)),
    [signals, node.hiddenSignalIds],
  );
  const filteredSignals = allSignals.filter((signal) =>
    `${signal.id} ${signal.name} ${signal.units ?? ""}`
      .toLowerCase()
      .includes(signalQuery.trim().toLowerCase()),
  );
  const enumDisplay =
    node.enumDisplay ?? (enumAsBackground ? "background" : "series");
  const render = useMemo(
    () => classifyPaneSignals(visibleSignals, enumDisplay),
    [visibleSignals, enumDisplay],
  );
  const hasEnum = visibleSignals.some((signal) => signal.discrete);
  // Only the states this enum actually takes, so a 20-variant enum does not
  // print 20 swatches.
  const bandVariants = useMemo(() => {
    const band = render.band;
    if (!band) return [];
    const codes = new Set<number>();
    for (const value of band.data.value) {
      codes.add(Math.round(value));
      if (codes.size > 12) break;
    }
    return [...codes]
      .sort((a, b) => a - b)
      .map((code) => ({
        code,
        label: band.enumLabels?.[code] ?? String(code),
      }));
  }, [render.band]);
  // Only signals that actually take a y axis count: an enum drawn as a
  // background band takes none, so it must not push the panel into
  // relative-trend mode.
  const tooManyUnits = new Set(render.plotted.map(axisKey)).size > 2;
  const normalized =
    render.mode === "lines" && (node.normalized || tooManyUnits);
  const title = node.title || `Plot ${index + 1}`;
  // While linked every pane shows the dashboard window; unlinked, a pane keeps
  // its own only once it has actually been moved.
  const paneRange = linkTimeAxis ? range : (node.timeWindow ?? range);
  const pinned = !linkTimeAxis && !!node.timeWindow;
  const windowLabel =
    `${formatWindowTime(paneRange.start, domain, timeUnit)}` +
    `–${formatWindowTime(paneRange.end, domain, timeUnit)} ${timeUnit}`;
  const saveTitle = () => {
    const next = draftTitle.trim().slice(0, 80);
    if (next && next !== title) onChange(node.id, { title: next });
    else setDraftTitle(title);
    setEditingTitle(false);
  };

  const startRename = () => {
    setDraftTitle(title);
    setEditingTitle(true);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <section
          ref={setNodeRef}
          // Radix composes this before its own handler and only skips its own when
          // defaultPrevented is set, so stopping propagation keeps this menu while
          // hiding the event from the workspace menu wrapping the whole area.
          onContextMenu={(event) => event.stopPropagation()}
          className={`border-border/80 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-[border-color,box-shadow] dark:bg-[#21252c] ${isOver ? "border-primary ring-primary/25 ring-2" : ""}`}
          aria-label={`Chart panel ${index + 1}`}
          data-pane-id={node.id}
        >
          <div className="border-border/60 bg-muted/35 flex min-h-11 shrink-0 items-center gap-2 border-b px-3 py-1.5">
            <span className="text-muted-foreground text-[10px] font-semibold tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            {!linkTimeAxis && (
              <span
                className={`shrink-0 rounded px-1 py-0.5 font-mono text-[10px] leading-none tabular-nums ${
                  pinned
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground bg-transparent"
                }`}
                title={
                  pinned
                    ? "This plot has its own time window"
                    : "Visible time window for this plot"
                }
              >
                {windowLabel}
              </span>
            )}
            {editingTitle ? (
              <Input
                autoFocus
                value={draftTitle}
                maxLength={80}
                aria-label={`Title for chart ${index + 1}`}
                className="h-7 min-w-0 flex-1 text-xs font-semibold"
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveTitle();
                  if (event.key === "Escape") {
                    setDraftTitle(title);
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                disabled={locked}
                className="group/title flex min-w-0 flex-1 items-center gap-1.5 text-left"
                title={locked ? title : `${title} · double-click to rename`}
                onDoubleClick={startRename}
              >
                <h2 className="truncate text-xs font-semibold">{title}</h2>
                {!locked && (
                  <Pencil className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover/title:opacity-100" />
                )}
              </button>
            )}
            <fieldset
              disabled={locked}
              className="flex min-w-0 shrink-0 items-center gap-0.5"
            >
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!canSplit}
                onClick={() => onSplit(node.id, "horizontal")}
                aria-label={`Split chart ${index + 1} into columns`}
                title="Split side by side"
              >
                <Columns className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!canSplit}
                onClick={() => onSplit(node.id, "vertical")}
                aria-label={`Split chart ${index + 1} into rows`}
                title="Split top and bottom"
              >
                <Rows2 className="size-3.5" />
              </Button>
              <Popover open={configOpen} onOpenChange={setConfigOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Configure chart ${index + 1}`}
                    title="Signals, units and scale"
                  >
                    <Settings2 className="size-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[20rem] max-w-[calc(100vw-2rem)] p-0"
                  // A settings panel should outlive anything that steals focus
                  // behind it (a closing menu, the ECharts canvas, dnd-kit).
                  // Pointer-outside and Escape still close it.
                  onFocusOutside={(event) => event.preventDefault()}
                >
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">Signals & units</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Choose signals to compare in this panel.
                    </p>
                  </div>
                  <div className="border-b px-3 py-3">
                    <label className="text-muted-foreground flex items-center gap-2 text-xs">
                      Plot title
                      <Input
                        value={draftTitle}
                        maxLength={80}
                        onFocus={(event) => {
                          setDraftTitle(title);
                          event.currentTarget.select();
                        }}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveTitle();
                        }}
                        aria-label={`Plot title for chart ${index + 1}`}
                        className="h-8 flex-1 text-xs"
                      />
                    </label>
                  </div>
                  <div className="px-3 pt-3">
                    <Input
                      value={signalQuery}
                      onChange={(event) => setSignalQuery(event.target.value)}
                      placeholder="Search signals, boards or units…"
                      aria-label={`Search signals for chart ${index + 1}`}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="max-h-[18rem] overflow-y-auto p-2">
                    {filteredSignals.length === 0 && (
                      <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                        No matching signals.
                      </p>
                    )}
                    {filteredSignals.map((signal) => {
                      const checked = node.signalIds.includes(signal.id);
                      // Refuse the mix up front rather than after the fact.
                      const blocked =
                        !checked && !canMixSignals(signals, [signal]);
                      return (
                        <div
                          key={signal.id}
                          className={`hover:bg-muted/40 rounded-md px-2 py-2 ${
                            blocked ? "opacity-50" : ""
                          }`}
                          title={blocked ? MIXED_ENUM_MESSAGE : undefined}
                        >
                          <label className="flex cursor-pointer items-center gap-2 text-xs">
                            <Checkbox
                              checked={checked}
                              disabled={blocked}
                              onCheckedChange={(next) =>
                                onChange(node.id, {
                                  hiddenSignalIds: node.hiddenSignalIds?.filter(
                                    (id) => id !== signal.id,
                                  ),
                                  signalIds: next
                                    ? [...node.signalIds, signal.id]
                                    : node.signalIds.filter(
                                        (id) => id !== signal.id,
                                      ),
                                })
                              }
                              aria-label={`Show ${signal.board} / ${signal.name} in chart ${index + 1}`}
                            />
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: signal.color }}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-muted-foreground">
                                {signal.board} /{" "}
                              </span>
                              {signal.name}
                            </span>
                          </label>
                          {checked && !signal.discrete && (
                            <label className="text-muted-foreground mt-2 flex items-center gap-2 pl-6 text-[11px]">
                              Unit
                              <Input
                                value={signal.units ?? ""}
                                onChange={(event) =>
                                  onUnitChange(signal.id, event.target.value)
                                }
                                placeholder="e.g. m/s, °C, V"
                                maxLength={24}
                                aria-label={`Unit for ${signal.board} / ${signal.name}`}
                                className="h-7 flex-1 text-xs"
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={normalized}
                        disabled={tooManyUnits}
                        onCheckedChange={(checked) =>
                          onChange(node.id, { normalized: checked === true })
                        }
                      />
                      Compare relative trends (0–100%)
                    </label>
                    <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                      {tooManyUnits
                        ? "More than two unit scales use relative trends. Split this panel to inspect original scales."
                        : "Original values use a separate axis for each unit. Editing a unit label does not convert values."}
                    </p>
                  </div>
                  {hasEnum && render.mode === "lines" && (
                    <div className="border-t px-4 py-3">
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={enumDisplay === "background"}
                          onCheckedChange={(checked) =>
                            onChange(node.id, {
                              enumDisplay:
                                checked === true ? "background" : "series",
                            })
                          }
                          aria-label="Draw the enum as a background band"
                        />
                        Enum as background band
                      </label>
                      <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                        A band keeps the numeric axes to themselves. Unchecked,
                        the enum is drawn as a step line on its own axis.
                      </p>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onFocus(node.id)}
                aria-label={`${focused ? "Restore" : "Expand"} chart ${index + 1}`}
                title={focused ? "Restore panels" : "Expand panel"}
              >
                {focused ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </Button>
              {canClose && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onClose(node.id)}
                  aria-label={`Close chart ${index + 1}`}
                  title="Close panel"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </fieldset>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-[10px]">
            {signals.map((signal) => {
              const hidden = !!node.hiddenSignalIds?.includes(signal.id);
              const label = `${signal.board} / ${signal.name}`;
              const toggleTrace = () =>
                onChange(node.id, {
                  hiddenSignalIds: hidden
                    ? (node.hiddenSignalIds ?? []).filter(
                        (id) => id !== signal.id,
                      )
                    : [...(node.hiddenSignalIds ?? []), signal.id],
                });
              return (
                <ContextMenu key={signal.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={locked}
                      // Keep this chip's menu from also opening the plot's one.
                      onContextMenu={(event) => event.stopPropagation()}
                      className={`hover:bg-muted/60 focus-visible:ring-ring inline-flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left focus-visible:ring-2 focus-visible:outline-none ${hidden ? "opacity-50" : ""}`}
                      aria-label={`${hidden ? "Show" : "Hide"} ${label} in chart ${index + 1}`}
                      aria-pressed={!hidden}
                      title="Click to hide or show this trace"
                      onClick={toggleTrace}
                    >
                      {render.band?.id === signal.id ? (
                        <span className="flex shrink-0 overflow-hidden rounded-sm">
                          {bandVariants.map((variant) => (
                            <span
                              key={variant.code}
                              className="h-2 w-1.5"
                              style={{
                                backgroundColor: enumVariantColor(variant.code),
                              }}
                              title={variant.label}
                            />
                          ))}
                        </span>
                      ) : (
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: signal.color }}
                        />
                      )}
                      <span className="text-muted-foreground max-w-[14rem] truncate">
                        {label}
                      </span>
                      {hidden && <EyeOff className="size-3" />}
                      {signal.units && (
                        <span className="bg-muted/70 rounded px-1.5 py-0.5 font-mono">
                          {signal.units}
                        </span>
                      )}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent aria-label={`${label} actions`}>
                    <ContextMenuItem disabled={locked} onClick={toggleTrace}>
                      {hidden ? (
                        <Eye className="size-3.5" />
                      ) : (
                        <EyeOff className="size-3.5" />
                      )}
                      {hidden ? "Show this trace" : "Hide this trace"}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => void navigator.clipboard?.writeText(label)}
                    >
                      <Layers className="size-3.5" />
                      Copy name
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      disabled={locked}
                      onClick={() =>
                        onChange(node.id, {
                          signalIds: node.signalIds.filter(
                            (id) => id !== signal.id,
                          ),
                          hiddenSignalIds: (node.hiddenSignalIds ?? []).filter(
                            (id) => id !== signal.id,
                          ),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                      Remove from this plot
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
            {normalized && (
              <span className="text-primary ml-auto font-medium">
                Relative %
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {visibleSignals.length > 0 ? (
              <ComparisonChart
                locked={locked}
                signals={render.plotted}
                band={render.band}
                timeline={render.mode === "timeline"}
                domain={domain}
                range={paneRange}
                timeUnit={timeUnit}
                normalized={normalized}
                isDarkMode={isDarkMode}
                syncGroup={syncGroup}
                orders={orders}
                showOrders={showOrders}
                onRangeChange={(next) => onRangeChange(node.id, next)}
              />
            ) : signals.length > 0 ? (
              <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-xs">
                <EyeOff className="size-5" />
                <p>All traces in this panel are hidden.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(node.id, { hiddenSignalIds: [] })}
                  disabled={locked}
                >
                  <Eye className="size-3.5" /> Show all traces
                </Button>
              </div>
            ) : (
              <div
                className={`text-muted-foreground flex h-full items-center justify-center px-6 text-center text-xs ${isOver ? "bg-primary/5 text-primary" : ""}`}
              >
                {node.signalIds.length ? (
                  "Loading measurements…"
                ) : (
                  <div className="space-y-1">
                    <p className="text-foreground font-medium">
                      {isOver ? "Release to add measurements" : "Empty plot"}
                    </p>
                    <p>
                      Select measurements, then drag them here or use Add to
                      plot.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </ContextMenuTrigger>
      <ContextMenuContent
        aria-label={`Chart ${index + 1} actions`}
        // Radix restores focus to the trigger in a setTimeout that runs after
        // the exit animation, i.e. after the popover we just opened has
        // mounted; that focusin reads as "focus outside" and closes it. No
        // deferral can win that race, so skip the restore just for this path
        // and keep it for every other close (Escape, other items).
        onCloseAutoFocus={(event) => {
          if (!reopenConfigRef.current) return;
          reopenConfigRef.current = false;
          event.preventDefault();
        }}
      >
        <ContextMenuItem disabled={locked} onClick={startRename}>
          <Pencil className="size-3.5" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          disabled={locked || selectedIds.length === 0}
          onClick={() => assignSignals(node.id, selectedIds)}
        >
          <Layers className="size-3.5" />
          Add {selectedIds.length || ""} selected measurement
          {selectedIds.length === 1 ? "" : "s"}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={locked}
          onClick={() => {
            reopenConfigRef.current = true;
            setConfigOpen(true);
          }}
        >
          <Settings2 className="size-3.5" />
          Signals, units and scale
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={locked || !canSplit}
          onClick={() => onSplit(node.id, "horizontal")}
        >
          <Columns className="size-3.5" />
          Split into columns
        </ContextMenuItem>
        <ContextMenuItem
          disabled={locked || !canSplit}
          onClick={() => onSplit(node.id, "vertical")}
        >
          <Rows2 className="size-3.5" />
          Split into rows
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onFocus(node.id)}>
          {focused ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
          {focused ? "Restore panels" : "Expand panel"}
        </ContextMenuItem>
        {!linkTimeAxis && (
          <ContextMenuItem
            disabled={locked || !pinned}
            onClick={() => onRangeChange(node.id, null)}
          >
            <RotateCcw className="size-3.5" />
            Reset this plot&apos;s zoom
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem
          disabled={locked || tooManyUnits}
          checked={normalized}
          onCheckedChange={(checked) =>
            onChange(node.id, { normalized: checked === true })
          }
        >
          Normalize to 0–100%
        </ContextMenuCheckboxItem>
        <ContextMenuItem
          disabled={locked || !node.hiddenSignalIds?.length}
          onClick={() => onChange(node.id, { hiddenSignalIds: [] })}
        >
          <Eye className="size-3.5" />
          Show all traces
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          disabled={locked || node.signalIds.length === 0}
          onClick={() =>
            onChange(node.id, { signalIds: [], hiddenSignalIds: [] })
          }
        >
          <Trash2 className="size-3.5" />
          Clear measurements
        </ContextMenuItem>
        {canClose && (
          <ContextMenuItem
            variant="destructive"
            disabled={locked}
            onClick={() => onClose(node.id)}
          >
            <X className="size-3.5" />
            Close plot
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface LayoutNodeProps extends Omit<
  PaneProps,
  "node" | "index" | "focused"
> {
  node: ChartLayout;
  panes: ChartPane[];
  focusedId: string | null;
  onResizeStart: () => void;
  panelSizes: DashboardSettings["panelSizes"];
  onPanelResize: (id: string, sizes: Record<string, number>) => void;
}

function LayoutNode({
  node,
  panes,
  focusedId,
  onResizeStart,
  panelSizes,
  onPanelResize,
  ...props
}: LayoutNodeProps) {
  if (node.type === "pane")
    return (
      <ComparisonPane
        {...props}
        node={node}
        index={panes.findIndex((pane) => pane.id === node.id)}
        focused={focusedId === node.id}
      />
    );
  const firstSize = minimumLayoutSize(node.first);
  const secondSize = minimumLayoutSize(node.second);
  const dimension = node.direction === "horizontal" ? "width" : "height";
  return (
    <ResizablePanelGroup
      id={node.id}
      orientation={node.direction}
      defaultLayout={panelSizes[node.id]}
      disabled={props.locked}
      onLayoutChanged={(sizes) => onPanelResize(node.id, sizes)}
    >
      <ResizablePanel
        id={`${node.id}-first`}
        defaultSize="50%"
        minSize={firstSize[dimension]}
      >
        <LayoutNode
          {...props}
          node={node.first}
          panes={panes}
          focusedId={focusedId}
          onResizeStart={onResizeStart}
          panelSizes={panelSizes}
          onPanelResize={onPanelResize}
        />
      </ResizablePanel>
      <ResizableHandle
        withHandle
        onPointerDown={onResizeStart}
        onKeyDown={(event) => {
          if (event.key.startsWith("Arrow")) onResizeStart();
        }}
        className="[&>div]:bg-muted [&>div]:border-border mx-1 w-0.5 shrink-0 bg-transparent aria-[orientation=horizontal]:mx-0 aria-[orientation=horizontal]:my-1 aria-[orientation=horizontal]:h-0.5"
      />
      <ResizablePanel
        id={`${node.id}-second`}
        defaultSize="50%"
        minSize={secondSize[dimension]}
      >
        <LayoutNode
          {...props}
          node={node.second}
          panes={panes}
          focusedId={focusedId}
          onResizeStart={onResizeStart}
          panelSizes={panelSizes}
          onPanelResize={onPanelResize}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default function AnalysisWorkspace({
  dashboard,
  signals,
  isDarkMode,
}: {
  dashboard: NormalDashboard;
  signals: ComparisonSignal[];
  isDarkMode: boolean;
}) {
  const syncGroup = useId();
  const [layoutState, setLayoutState] = useDashboardSetting(
    dashboard,
    "layoutState",
  );
  const [showStatistics, setShowStatistics] = useDashboardSetting(
    dashboard,
    "showStatistics",
  );
  const [statisticsColumns, setStatisticsColumns] = useDashboardSetting(
    dashboard,
    "statisticsColumns",
  );
  const [showOrders, setShowOrders] = useDashboardSetting(
    dashboard,
    "showOrders",
  );
  const [enumAsBackground, setEnumAsBackground] = useDashboardSetting(
    dashboard,
    "enumAsBackground",
  );
  const orders = useStore((state) => state.orders);
  const plotWarning = useStore((state) => state.normalPlotWarning);
  const setPlotWarning = useStore((state) => state.setNormalPlotWarning);

  useEffect(() => {
    if (!plotWarning) return;
    const timer = setTimeout(() => setPlotWarning(null), 6000);
    return () => clearTimeout(timer);
  }, [plotWarning, setPlotWarning]);
  const { selectedSeries } = useSeriesSelection();
  const addPlot = useStore((state) => state.addNormalPlot);
  const selectedIds = useMemo(
    () => Object.keys(selectedSeries).filter((key) => selectedSeries[key]),
    [selectedSeries],
  );
  const [focusedId, setFocusedId] = useDashboardSetting(dashboard, "focusedId");
  const [units, setUnits] = useDashboardSetting(dashboard, "units");
  const timeUnit = dashboard.settings.timeUnit;
  const { range, linkTimeAxis, setRange, setRangeForAll, setPaneWindow } =
    useDashboardTimeWindow(dashboard);
  const [panelSizes, setPanelSizes] = useDashboardSetting(
    dashboard,
    "panelSizes",
  );
  const resizePanel = useCallback(
    (id: string, sizes: Record<string, number>) => {
      setPanelSizes((current) => {
        const previous = current[id];
        return previous &&
          Object.keys(previous).length === Object.keys(sizes).length &&
          Object.entries(sizes).every(
            ([key, value]) => Math.abs(previous[key] - value) < 0.01,
          )
          ? current
          : { ...current, [id]: sizes };
      });
    },
    [setPanelSizes],
  );

  // `echarts.connect` is a module-level flag keyed by group id, consulted when
  // an action is broadcast. Owning it here (instead of inside each chart) means
  // unlinking really stops the broadcast, and no chart is ever re-initialised.
  useEffect(() => {
    if (linkTimeAxis) echarts.connect(syncGroup);
    return () => {
      echarts.disconnect(syncGroup);
    };
  }, [linkTimeAxis, syncGroup]);

  const resolvedSignals = useMemo(
    () =>
      signals.map((signal) => ({
        ...signal,
        units: units[signal.id] ?? signal.units,
      })),
    [signals, units],
  );
  const domain = useMemo(
    () =>
      signals.length === 0
        ? { startMs: 0, endMs: 1 }
        : {
            startMs: Math.min(...signals.map((signal) => signal.data.time[0])),
            endMs: Math.max(
              ...signals.map(
                (signal) => signal.data.time[signal.data.time.length - 1],
              ),
            ),
          },
    [signals],
  );
  const panes = getPanes(layoutState.tree);
  const focused = panes.find((pane) => pane.id === focusedId);
  const visibleLayout = focused ?? layoutState.tree;
  const size = minimumLayoutSize(visibleLayout);

  const changeRange = useCallback(
    (paneId: string, next: TimeRange | null) => {
      if (!next) setPaneWindow(paneId, null);
      else if (linkTimeAxis) setRange(next);
      else setPaneWindow(paneId, next);
    },
    [linkTimeAxis, setRange, setPaneWindow],
  );
  const changePane = useCallback(
    (
      id: string,
      changes: Partial<
        Pick<
          ChartPane,
          "title" | "signalIds" | "normalized" | "hiddenSignalIds"
        >
      >,
    ) => {
      setLayoutState((current) => ({
        ...current,
        preset: null,
        tree: updatePane(current.tree, id, (pane) => ({ ...pane, ...changes })),
      }));
    },
    [setLayoutState],
  );
  const split = (id: string, direction: "horizontal" | "vertical") => {
    setLayoutState((current) => ({
      ...current,
      preset: null,
      tree: splitPane(current.tree, id, direction),
    }));
  };
  const close = (id: string) => {
    setFocusedId(null);
    setLayoutState((current) => ({
      ...current,
      preset: null,
      tree: removePane(current.tree, id) ?? current.tree,
    }));
  };
  const formatTime = (percent: number) =>
    formatWindowTime(percent, domain, timeUnit);
  const statisticsGroups = useMemo<StatisticsGroup[]>(() => {
    if (linkTimeAxis)
      return [
        {
          id: dashboard.id,
          label: "All plots",
          range,
          signals: resolvedSignals,
        },
      ];
    // A signal assigned to two plots legitimately appears twice: different
    // windows, different numbers.
    return panes.map((pane, index) => ({
      id: pane.id,
      label: pane.title || `Plot ${index + 1}`,
      range: pane.timeWindow ?? range,
      signals: resolvedSignals.filter((signal) =>
        pane.signalIds.includes(signal.id),
      ),
    }));
  }, [linkTimeAxis, dashboard.id, range, resolvedSignals, panes]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Signal analysis workspace"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div
              className="h-full w-full"
              style={{ minWidth: size.width, minHeight: size.height }}
            >
              <LayoutNode
                dashboardId={dashboard.id}
                locked={dashboard.locked}
                panelSizes={panelSizes}
                onPanelResize={resizePanel}
                node={visibleLayout}
                panes={panes}
                focusedId={focused ? focusedId : null}
                allSignals={resolvedSignals}
                orders={orders}
                showOrders={showOrders ?? true}
                domain={domain}
                range={range}
                linkTimeAxis={linkTimeAxis}
                enumAsBackground={enumAsBackground}
                timeUnit={timeUnit}
                isDarkMode={isDarkMode}
                syncGroup={syncGroup}
                canSplit={panes.length < MAX_PANES && !focused}
                canClose={panes.length > 1}
                onRangeChange={changeRange}
                onSplit={split}
                onClose={close}
                onFocus={(id) =>
                  setFocusedId((current) => (current === id ? null : id))
                }
                onChange={changePane}
                onUnitChange={(id, unit) =>
                  setUnits((current) => ({ ...current, [id]: unit }))
                }
                onResizeStart={() =>
                  setLayoutState((current) => ({ ...current, preset: null }))
                }
              />
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label="Workspace actions">
          <ContextMenuItem
            disabled={dashboard.locked || panes.length >= MAX_PANES}
            onClick={() => addPlot()}
          >
            <Plus className="size-3.5" />
            New plot
          </ContextMenuItem>
          <ContextMenuItem
            disabled={
              dashboard.locked ||
              panes.length >= MAX_PANES ||
              selectedIds.length === 0
            }
            onClick={() => addPlot(selectedIds)}
          >
            <Layers className="size-3.5" />
            New plot from {selectedIds.length || ""} selected measurement
            {selectedIds.length === 1 ? "" : "s"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={dashboard.locked}>
              <Grid2X2 className="size-3.5" />
              Layout
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {LAYOUT_ITEMS.map(({ value, label, Icon }) => (
                <ContextMenuItem
                  key={value}
                  disabled={value === "single" && panes.length > 1}
                  onClick={() => {
                    setFocusedId(null);
                    setLayoutState({
                      ids: layoutState.ids,
                      tree: arrangePanes(panes, value),
                      preset: value,
                    });
                  }}
                >
                  <Icon className="size-3.5" />
                  {label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem
            disabled={dashboard.locked}
            checked={showStatistics}
            onCheckedChange={(checked) => setShowStatistics(checked === true)}
          >
            Window statistics
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            disabled={dashboard.locked || orders.length === 0}
            checked={showOrders ?? true}
            onCheckedChange={(checked) => setShowOrders(checked === true)}
          >
            <Send className="size-3.5" />
            Order markers ({orders.length})
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            disabled={dashboard.locked}
            checked={enumAsBackground}
            onCheckedChange={(checked) => setEnumAsBackground(checked === true)}
          >
            <Layers className="size-3.5" />
            Enum background
          </ContextMenuCheckboxItem>
          <ContextMenuItem
            disabled={dashboard.locked}
            onClick={() => setRangeForAll({ start: 0, end: 100 })}
          >
            <RotateCcw className="size-3.5" />
            Reset zoom
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {plotWarning && (
        <div
          role="alert"
          className="border-border bg-muted/40 text-muted-foreground flex shrink-0 items-start gap-2 border-t px-4 py-2 text-[11px]"
        >
          <AlertTriangle className="text-primary mt-0.5 size-3.5 shrink-0" />
          <span className="flex-1">{plotWarning}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 opacity-70 hover:opacity-100"
            onClick={() => setPlotWarning(null)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {showStatistics && (
        <WindowStatistics
          groups={statisticsGroups}
          domain={domain}
          onClose={() => setShowStatistics(false)}
          columns={statisticsColumns}
          onColumnsChange={setStatisticsColumns}
        />
      )}
      <div className="text-muted-foreground border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[10px]">
        <span>
          {dashboard.locked
            ? "Dashboard locked · Unlock in tab settings to edit"
            : "Drop selected measurements onto a plot · Scroll to zoom · Shift+scroll or drag to pan"}
        </span>
        <span className="font-mono tabular-nums">
          {panes.length} panels ·{" "}
          {linkTimeAxis
            ? `${formatTime(range.start)}–${formatTime(range.end)} ${timeUnit}`
            : "independent windows"}
        </span>
      </div>
    </div>
  );
}
