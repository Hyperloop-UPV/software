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
} from "@workspace/ui/components";
import { Columns, Plus, Settings2, X } from "@workspace/ui/icons";
import * as echarts from "echarts";
import {
  Grid2X2,
  Link2,
  Maximize2,
  Minimize2,
  Minus,
  RotateCcw,
  Rows2,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  createLayout,
  getPanes,
  minimumLayoutSize,
  reconcileLayout,
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
  type LayoutPreset,
  type TimeDomain,
  type TimeRange,
  type TimeUnit,
} from "../../types/normal";
import ComparisonChart from "./ComparisonChart";

const MAX_PANES = 8;
const PRESETS = [
  { value: "single", label: "Single", Icon: Square },
  { value: "columns", label: "Columns", Icon: Columns },
  { value: "rows", label: "Rows", Icon: Rows2 },
  { value: "grid", label: "Grid", Icon: Grid2X2 },
] as const;

interface PaneProps {
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
    changes: Partial<Pick<ChartPane, "signalIds" | "normalized">>,
  ) => void;
  onUnitChange: (id: string, unit: string) => void;
}

function ComparisonPane({
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
  const signals = useMemo(
    () => allSignals.filter((signal) => node.signalIds.includes(signal.id)),
    [allSignals, node.signalIds],
  );
  const tooManyUnits = new Set(signals.map(axisKey)).size > 2;
  const normalized = node.normalized || tooManyUnits;
  const title = signals.length === 1 ? signals[0].name : "Comparison";

  return (
    <section
      className="border-border/80 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-[#21252c]"
      aria-label={`Chart panel ${index + 1}`}
      data-pane-id={node.id}
    >
      <div className="border-border/60 bg-muted/35 flex min-h-11 shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground text-[10px] font-semibold tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h2
          className="min-w-0 flex-1 truncate text-xs font-semibold"
          title={title}
        >
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
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
              <div className="max-h-[18rem] overflow-y-auto p-2">
                {allSignals.map((signal) => {
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
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-[10px]">
        {signals.map((signal) => (
          <span
            key={signal.id}
            className="inline-flex min-w-0 items-center gap-1.5"
            title={`${signal.board} / ${signal.name}`}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: signal.color }}
            />
            <span className="text-muted-foreground max-w-[14rem] truncate">
              {signal.board} / {signal.name}
            </span>
            {signal.units && (
              <span className="bg-muted/70 rounded px-1.5 py-0.5 font-mono">
                {signal.units}
              </span>
            )}
          </span>
        ))}
        {normalized && (
          <span className="text-primary ml-auto font-medium">Relative %</span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {signals.length > 0 ? (
          <ComparisonChart
            signals={signals}
            domain={domain}
            range={range}
            timeUnit={timeUnit}
            normalized={normalized}
            isDarkMode={isDarkMode}
            syncGroup={syncGroup}
            onRangeChange={onRangeChange}
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-xs">
            {node.signalIds.length
              ? "Loading signal…"
              : "Use the settings button to add signals to this panel."}
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
}

function LayoutNode({
  node,
  panes,
  focusedId,
  onResizeStart,
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
    <ResizablePanelGroup id={node.id} orientation={node.direction}>
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
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default function AnalysisWorkspace({
  signals,
  selectedIds,
  isDarkMode,
}: {
  signals: ComparisonSignal[];
  selectedIds: string[];
  isDarkMode: boolean;
}) {
  const syncGroup = useId();
  const [layoutState, setLayoutState] = useState(() => ({
    ids: selectedIds,
    tree: createLayout(selectedIds, "grid"),
    preset: "grid" as LayoutPreset | null,
  }));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("s");
  const [range, setRange] = useState<TimeRange>({ start: 0, end: 100 });

  if (layoutState.ids !== selectedIds) {
    setLayoutState({
      ...layoutState,
      ids: selectedIds,
      tree: layoutState.preset
        ? createLayout(selectedIds, layoutState.preset)
        : reconcileLayout(layoutState.tree, layoutState.ids, selectedIds),
    });
  }

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
    () => ({
      startMs: Math.min(...signals.map((signal) => signal.data.time[0])),
      endMs: Math.max(
        ...signals.map(
          (signal) => signal.data.time[signal.data.time.length - 1],
        ),
      ),
    }),
    [signals],
  );
  const panes = getPanes(layoutState.tree);
  const focused = panes.find((pane) => pane.id === focusedId);
  const visibleLayout = focused ?? layoutState.tree;
  const size = minimumLayoutSize(visibleLayout);

  const changeRange = useCallback((next: TimeRange) => {
    setRange((current) =>
      Math.abs(current.start - next.start) < 0.0001 &&
      Math.abs(current.end - next.end) < 0.0001
        ? current
        : next,
    );
  }, []);
  const changePane = useCallback(
    (
      id: string,
      changes: Partial<Pick<ChartPane, "signalIds" | "normalized">>,
    ) => {
      setLayoutState((current) => ({
        ...current,
        preset: null,
        tree: updatePane(current.tree, id, (pane) => ({ ...pane, ...changes })),
      }));
    },
    [],
  );
  const split = (id: string, direction: "horizontal" | "vertical") => {
    setLayoutState((current) => ({
      ...current,
      preset: null,
      tree: splitPane(current.tree, id, direction, selectedIds),
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
  const zoom = (factor: number) => {
    const span = Math.min(
      100,
      Math.max(0.01, (range.end - range.start) * factor),
    );
    const start = Math.max(
      0,
      Math.min(100 - span, (range.start + range.end - span) / 2),
    );
    changeRange({ start, end: start + span });
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
      <div className="border-border bg-muted/15 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground mr-1 text-[11px] font-medium">
            Layout
          </span>
          <div
            className="bg-muted/60 flex items-center gap-0.5 rounded-lg p-1"
            role="group"
            aria-label="Chart layout"
          >
            {PRESETS.map(({ value, label, Icon }) => (
              <Button
                key={value}
                variant={layoutState.preset === value ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                aria-pressed={layoutState.preset === value}
                onClick={() => {
                  setFocusedId(null);
                  setLayoutState({
                    ids: selectedIds,
                    tree: createLayout(selectedIds, value),
                    preset: value,
                  });
                }}
              >
                <Icon className="size-3.5" />
                {label}
              </Button>
            ))}
          </div>
          <span className="text-muted-foreground ml-1 inline-flex items-center gap-1.5 text-[11px]">
            <Link2 className="size-3" />
            Linked time
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground flex items-center gap-2 text-[11px]">
            Time
            <select
              value={timeUnit}
              onChange={(event) => setTimeUnit(event.target.value as TimeUnit)}
              aria-label="Time unit"
              className="border-input bg-background text-foreground h-7 rounded-md border px-2 text-xs"
            >
              <option value="ms">ms</option>
              <option value="s">s</option>
              <option value="min">min</option>
            </select>
          </label>
          <div className="border-border mx-1 h-4 border-l" />
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Zoom in comparison"
            onClick={() => zoom(0.5)}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Zoom out comparison"
            onClick={() => zoom(2)}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => changeRange({ start: 0, end: 100 })}
          >
            <RotateCcw className="size-3" />
            Reset zoom
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div
          className="h-full w-full"
          style={{ minWidth: size.width, minHeight: size.height }}
        >
          <LayoutNode
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
      <div className="text-muted-foreground border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[10px]">
        <span>
          Scroll to zoom · Drag charts to pan · Drag dividers to resize
        </span>
        <span className="font-mono tabular-nums">
          {panes.length} panels · {formatTime(range.start)}–
          {formatTime(range.end)} {timeUnit}
        </span>
      </div>
    </div>
  );
}
