import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hyperloopupv/frontend-kit/components";
import {
  ChartNoAxesCombined,
  ChevronDown,
  Clock,
  Columns,
  Eye,
  Grid2X2,
  Layers,
  Link2Off,
  Minus,
  Plus,
  RotateCcw,
  Rows2,
  Send,
  Square,
} from "@hyperloopupv/frontend-kit/icons";
import { useState } from "react";
import { useDashboardSetting } from "../../hooks/useDashboardSetting";
import { useDashboardTimeWindow } from "../../hooks/useDashboardTimeWindow";
import { arrangePanes, getPanes } from "../../lib/normal/layout";
import { useStore } from "../../store/store";
import {
  TIME_DIVISORS,
  type ComparisonSignal,
  type NormalDashboard,
} from "../../types/normal";
import TimeWindowControls from "./TimeWindowControls";

const PRESETS = [
  { value: "single", label: "Single", Icon: Square },
  { value: "columns", label: "Columns", Icon: Columns },
  { value: "rows", label: "Rows", Icon: Rows2 },
  { value: "grid", label: "Grid", Icon: Grid2X2 },
] as const;

export default function DashboardControls({
  dashboard,
  signals,
  compact,
}: {
  dashboard: NormalDashboard;
  signals: ComparisonSignal[];
  compact: boolean;
}) {
  const [layoutState, setLayoutState] = useDashboardSetting(
    dashboard,
    "layoutState",
  );
  const [, setFocusedId] = useDashboardSetting(dashboard, "focusedId");
  const [showStatistics, setShowStatistics] = useDashboardSetting(
    dashboard,
    "showStatistics",
  );
  const [showOrders, setShowOrders] = useDashboardSetting(
    dashboard,
    "showOrders",
  );
  const [enumAsBackground, setEnumAsBackground] = useDashboardSetting(
    dashboard,
    "enumAsBackground",
  );
  const [timeUnit, setTimeUnit] = useDashboardSetting(dashboard, "timeUnit");
  // Toolbar actions are dashboard-wide: they move every plot and pull any
  // individually panned one back onto the shared window.
  const { range, linkTimeAxis, setRangeForAll, setLinked } =
    useDashboardTimeWindow(dashboard);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const addNormalPlot = useStore((state) => state.addNormalPlot);
  const orderCount = useStore((state) => state.orders.length);
  const panes = getPanes(layoutState.tree);
  const chartDisabled = dashboard.locked || signals.length === 0;
  const startMs = signals.length
    ? Math.min(...signals.map((signal) => signal.data.time[0]))
    : 0;
  const endMs = signals.length
    ? Math.max(
        ...signals.map(
          (signal) => signal.data.time[signal.data.time.length - 1],
        ),
      )
    : 0;
  const duration = (endMs - startMs) / TIME_DIVISORS[timeUnit];
  const formatTime = (percent: number) =>
    ((duration * percent) / 100).toLocaleString(undefined, {
      maximumFractionDigits: 3,
    });
  const preset = PRESETS.find((item) => item.value === layoutState.preset);
  const LayoutIcon = preset?.Icon ?? Grid2X2;
  const zoom = (factor: number) => {
    const span = Math.min(
      100,
      Math.max(0.01, (range.end - range.start) * factor),
    );
    const start = Math.max(
      0,
      Math.min(100 - span, (range.start + range.end - span) / 2),
    );
    setRangeForAll({ start, end: start + span });
  };
  const layout = (
    <div
      className="bg-muted/60 flex items-center gap-0.5 rounded-lg p-1"
      role="group"
      aria-label="Chart layout"
    >
      {PRESETS.map(({ value, label, Icon }) => (
        <Button
          key={value}
          variant={layoutState.preset === value ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-7"
          aria-label={label}
          title={`${label} layout`}
          aria-pressed={layoutState.preset === value}
          disabled={value === "single" && panes.length > 1}
          onClick={() => {
            setFocusedId(null);
            setLayoutState({
              ids: layoutState.ids,
              tree: arrangePanes(panes, value),
              preset: value,
            });
            setLayoutOpen(false);
          }}
        >
          <Icon className="size-3.5" />
        </Button>
      ))}
    </div>
  );
  const timeWindow = (
    <TimeWindowControls
      key={`${dashboard.id}:${timeUnit}:${duration}:${range.start}:${range.end}`}
      duration={duration}
      range={range}
      timeUnit={timeUnit}
      linked={linkTimeAxis}
      onUnitChange={setTimeUnit}
      onChange={setRangeForAll}
      onLinkedChange={setLinked}
    />
  );
  // One menu for every overlay, so the bar speaks a single visual language
  // instead of two different "pressed" idioms sitting side by side.
  const overlayCount =
    (showStatistics ? 1 : 0) + ((showOrders ?? true) && orderCount > 0 ? 1 : 0);
  const viewMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label="Plot overlays"
          title="Choose what is drawn on every plot"
        >
          <Eye className="size-3.5" />
          <span className="hidden lg:inline">View</span>
          {overlayCount > 0 && (
            <Badge
              variant="secondary"
              className="h-4 px-1.5 text-[10px] leading-none tabular-nums"
            >
              {overlayCount}
            </Badge>
          )}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[15rem]">
        <DropdownMenuCheckboxItem
          checked={showStatistics}
          disabled={chartDisabled}
          aria-controls="window-statistics"
          onCheckedChange={(checked) => setShowStatistics(checked)}
        >
          <ChartNoAxesCombined className="size-3.5" />
          Window statistics
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showOrders ?? true}
          disabled={orderCount === 0}
          onCheckedChange={(checked) => setShowOrders(checked)}
        >
          <Send className="size-3.5" />
          Order markers
          {orderCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto h-4 px-1.5 text-[10px] leading-none tabular-nums"
            >
              {orderCount}
            </Badge>
          )}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={enumAsBackground}
          disabled={chartDisabled}
          onCheckedChange={(checked) => setEnumAsBackground(checked)}
        >
          <Layers className="size-3.5" />
          Enum background
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={chartDisabled}
          onClick={() => setRangeForAll({ start: 0, end: 100 })}
        >
          <RotateCcw className="size-3.5" />
          Reset zoom
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const zoomControls = (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Zoom in comparison"
        title="Zoom in"
        disabled={chartDisabled}
        onClick={() => zoom(0.5)}
      >
        <Plus className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Zoom out comparison"
        title="Zoom out"
        disabled={chartDisabled}
        onClick={() => zoom(2)}
      >
        <Minus className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        disabled={chartDisabled}
        onClick={() => setRangeForAll({ start: 0, end: 100 })}
      >
        <RotateCcw className="size-3" />
        Reset zoom
      </Button>
    </div>
  );

  return (
    <fieldset
      disabled={dashboard.locked}
      role="group"
      aria-label="Analysis controls"
      className={
        compact
          ? "flex min-w-0 items-center gap-1"
          : "border-border bg-muted/15 flex min-w-0 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5"
      }
    >
      {compact ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={panes.length >= 8}
            onClick={() => addNormalPlot()}
            aria-label="Create empty plot"
            title="Create empty plot"
          >
            <Plus className="size-3.5" />
            <span className="hidden xl:inline">New plot</span>
          </Button>
          <Popover open={layoutOpen} onOpenChange={setLayoutOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                aria-label="Layout settings"
                title="Layout settings"
              >
                <LayoutIcon className="size-3.5" />
                <span className="hidden lg:inline">
                  {preset?.label ?? "Custom"}
                </span>
                <ChevronDown className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-3">
              <p className="mb-2 text-xs font-semibold">Chart layout</p>
              {layout}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 min-w-0 gap-1.5 px-2 text-xs"
                aria-label="Time window settings"
                title="Time window settings"
              >
                {linkTimeAxis ? (
                  <Clock className="size-3.5" />
                ) : (
                  <Link2Off className="size-3.5" />
                )}
                <span className="max-w-32 truncate font-mono tabular-nums">
                  {formatTime(range.start)}–{formatTime(range.end)} {timeUnit}
                </span>
                <ChevronDown className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[34rem] max-w-[calc(100vw-2rem)] p-3"
            >
              <p className="mb-2 text-xs font-semibold">Time window</p>
              <fieldset disabled={chartDisabled} className="min-w-0 space-y-3">
                {timeWindow}
                {zoomControls}
              </fieldset>
            </PopoverContent>
          </Popover>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={panes.length >= 8}
            onClick={() => addNormalPlot()}
          >
            <Plus className="size-3.5" /> New plot
          </Button>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-[11px] font-medium">
              Layout
            </span>
            {layout}
          </div>
          <div
            aria-hidden="true"
            className="border-border hidden h-5 border-l lg:block"
          />
          {timeWindow}
        </>
      )}
      <div
        className={
          compact
            ? "flex items-center"
            : "ml-auto flex max-w-full flex-wrap items-center gap-2"
        }
      >
        {viewMenu}
        {!compact && (
          <>
            <div className="border-border mx-1 h-4 border-l" />
            {zoomControls}
          </>
        )}
      </div>
    </fieldset>
  );
}
