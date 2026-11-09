import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@hyperloopupv/frontend-kit/components";
import { Columns, Pencil, Settings2, X } from "@hyperloopupv/frontend-kit/icons";
import { useDroppable } from "@dnd-kit/core";
import * as echarts from "echarts";
import { Eye, EyeOff, Maximize2, Minimize2, Rows2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useDashboardSetting } from "../../hooks/useDashboardSetting";
import {
  getPanes,
  minimumLayoutSize,
  removePane,
  splitPane,
  updatePane,
} from "../../lib/normal/layout";
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
import ComparisonChart from "./ComparisonChart";
import WindowStatistics from "./WindowStatistics";

const MAX_PANES = 8;
interface PaneProps {
  dashboardId: string;
  locked: boolean;
  node: ChartPane;
  index: number;
  allSignals: ComparisonSignal[];
  domain: TimeDomain;
  range: TimeRange;
  timeUnit: TimeUnit;
  isDarkMode: boolean;
  syncGroup: string;
  canSplit: boolean;
  canClose: boolean;
  focused: boolean;
  onRangeChange: (range: TimeRange) => void;
  onSplit: (id: string, direction: "horizontal" | "vertical") => void;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onChange: (
    id: string,
    changes: Partial<
      Pick<ChartPane, "title" | "signalIds" | "normalized" | "hiddenSignalIds">
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
  domain,
  range,
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title ?? `Plot ${index + 1}`);
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
  const tooManyUnits = new Set(visibleSignals.map(axisKey)).size > 2;
  const normalized = node.normalized || tooManyUnits;
  const title = node.title || `Plot ${index + 1}`;
  const saveTitle = () => {
    const next = draftTitle.trim().slice(0, 80);
    if (next && next !== title) onChange(node.id, { title: next });
    else setDraftTitle(title);
    setEditingTitle(false);
  };

  return (
    <section
      ref={setNodeRef}
      className={`border-border/80 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-[border-color,box-shadow] dark:bg-[#21252c] ${isOver ? "border-primary ring-primary/25 ring-2" : ""}`}
      aria-label={`Chart panel ${index + 1}`}
      data-pane-id={node.id}
    >
      <div className="border-border/60 bg-muted/35 flex min-h-11 shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground text-[10px] font-semibold tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
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
            onDoubleClick={() => {
              setDraftTitle(title);
              setEditingTitle(true);
            }}
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
          <Popover>
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
                  return (
                    <div
                      key={signal.id}
                      className="hover:bg-muted/40 rounded-md px-2 py-2"
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={checked}
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
        {signals.map((signal) => (
          <button
            type="button"
            key={signal.id}
            disabled={locked}
            className={`hover:bg-muted/60 focus-visible:ring-ring inline-flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left focus-visible:ring-2 focus-visible:outline-none ${node.hiddenSignalIds?.includes(signal.id) ? "opacity-50" : ""}`}
            aria-label={`${node.hiddenSignalIds?.includes(signal.id) ? "Show" : "Hide"} ${signal.board} / ${signal.name} in chart ${index + 1}`}
            aria-pressed={!node.hiddenSignalIds?.includes(signal.id)}
            title="Click to hide or show this trace"
            onClick={() =>
              onChange(node.id, {
                hiddenSignalIds: node.hiddenSignalIds?.includes(signal.id)
                  ? node.hiddenSignalIds.filter((id) => id !== signal.id)
                  : [...(node.hiddenSignalIds ?? []), signal.id],
              })
            }
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: signal.color }}
            />
            <span className="text-muted-foreground max-w-[14rem] truncate">
              {signal.board} / {signal.name}
            </span>
            {node.hiddenSignalIds?.includes(signal.id) && (
              <EyeOff className="size-3" />
            )}
            {signal.units && (
              <span className="bg-muted/70 rounded px-1.5 py-0.5 font-mono">
                {signal.units}
              </span>
            )}
          </button>
        ))}
        {normalized && (
          <span className="text-primary ml-auto font-medium">Relative %</span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {visibleSignals.length > 0 ? (
          <ComparisonChart
            locked={locked}
            signals={visibleSignals}
            domain={domain}
            range={range}
            timeUnit={timeUnit}
            normalized={normalized}
            isDarkMode={isDarkMode}
            syncGroup={syncGroup}
            onRangeChange={onRangeChange}
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
          <div className={`text-muted-foreground flex h-full items-center justify-center px-6 text-center text-xs ${isOver ? "bg-primary/5 text-primary" : ""}`}>
            {node.signalIds.length ? (
              "Loading measurements…"
            ) : (
              <div className="space-y-1">
                <p className="text-foreground font-medium">
                  {isOver ? "Release to add measurements" : "Empty plot"}
                </p>
                <p>Select measurements, then drag them here or use Add to plot.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
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
  const showStatistics = dashboard.settings.showStatistics;
  const [focusedId, setFocusedId] = useDashboardSetting(dashboard, "focusedId");
  const [units, setUnits] = useDashboardSetting(dashboard, "units");
  const timeUnit = dashboard.settings.timeUnit;
  const [range, setRange] = useDashboardSetting(dashboard, "range");
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

  useEffect(
    () => () => {
      echarts.disconnect(syncGroup);
    },
    [syncGroup],
  );

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
    (next: TimeRange) => {
      setRange((current) =>
        Math.abs(current.start - next.start) < 0.0001 &&
        Math.abs(current.end - next.end) < 0.0001
          ? current
          : next,
      );
    },
    [setRange],
  );
  const changePane = useCallback(
    (
      id: string,
      changes: Partial<
        Pick<ChartPane, "title" | "signalIds" | "normalized" | "hiddenSignalIds">
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
  const duration = (domain.endMs - domain.startMs) / TIME_DIVISORS[timeUnit];
  const formatTime = (percent: number) =>
    ((duration * percent) / 100).toLocaleString(undefined, {
      maximumFractionDigits: 3,
    });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Signal analysis workspace"
    >
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
            domain={domain}
            range={range}
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
      {showStatistics && (
        <WindowStatistics
          signals={resolvedSignals}
          domain={domain}
          range={range}
        />
      )}
      <div className="text-muted-foreground border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[10px]">
        <span>
          {dashboard.locked
            ? "Dashboard locked · Unlock in tab settings to edit"
            : "Drop selected measurements onto a plot · Scroll to zoom · Drag charts to pan"}
        </span>
        <span className="font-mono tabular-nums">
          {panes.length} panels · {formatTime(range.start)}–
          {formatTime(range.end)} {timeUnit}
        </span>
      </div>
    </div>
  );
}
