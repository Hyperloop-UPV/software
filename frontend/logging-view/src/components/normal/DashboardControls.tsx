import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hyperloopupv/frontend-kit/components";
import {
  ChartNoAxesCombined,
  ChevronDown,
  Clock,
  Columns,
  Grid2X2,
  Minus,
  Plus,
  RotateCcw,
  Rows2,
  Square,
} from "@hyperloopupv/frontend-kit/icons";
import { useState } from "react";
import { useDashboardSetting } from "../../hooks/useDashboardSetting";
import { createLayout } from "../../lib/normal/layout";
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
  const [timeUnit, setTimeUnit] = useDashboardSetting(dashboard, "timeUnit");
  const [range, setRange] = useDashboardSetting(dashboard, "range");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const disabled = dashboard.locked || signals.length === 0;
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
    setRange({ start, end: start + span });
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
          disabled={disabled}
          onClick={() => {
            setFocusedId(null);
            setLayoutState({
              ids: layoutState.ids,
              tree: createLayout(layoutState.ids, value),
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
      onUnitChange={setTimeUnit}
      onChange={setRange}
    />
  );
  const zoomControls = (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Zoom in comparison"
        title="Zoom in"
        disabled={disabled}
        onClick={() => zoom(0.5)}
      >
        <Plus className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Zoom out comparison"
        title="Zoom out"
        disabled={disabled}
        onClick={() => zoom(2)}
      >
        <Minus className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        disabled={disabled}
        onClick={() => setRange({ start: 0, end: 100 })}
      >
        <RotateCcw className="size-3" />
        Reset zoom
      </Button>
    </div>
  );

  return (
    <fieldset
      disabled={disabled}
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
                <Clock className="size-3.5" />
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
              <fieldset disabled={disabled} className="min-w-0 space-y-3">
                {timeWindow}
                {zoomControls}
              </fieldset>
            </PopoverContent>
          </Popover>
        </>
      ) : (
        <>
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
        <Button
          variant={showStatistics ? "secondary" : "ghost"}
          size={compact ? "icon-sm" : "sm"}
          className={compact ? "size-7" : "h-7 gap-1.5 text-xs"}
          aria-label="Statistics"
          title="Statistics"
          aria-expanded={showStatistics}
          aria-controls="window-statistics"
          onClick={() => setShowStatistics((current) => !current)}
        >
          <ChartNoAxesCombined className="size-3.5" />
          {!compact && "Statistics"}
        </Button>
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
