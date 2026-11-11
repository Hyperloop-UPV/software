import type { EnumDisplay } from "../lib/normal/enums";

import type { SeriesData } from "./plotStudio";

export interface ComparisonSignal {
  id: string;
  board: string;
  name: string;
  units?: string;
  enumLabels?: string[];
  discrete: boolean;
  color: string;
  data: SeriesData;
}

export type TimeUnit = "us" | "ms" | "s" | "min";
export const TIME_DIVISORS: Record<TimeUnit, number> = {
  us: 0.001,
  ms: 1,
  s: 1_000,
  min: 60_000,
};

export interface TimeRange {
  start: number;
  end: number;
}

export interface TimeDomain {
  startMs: number;
  endMs: number;
}

export type StatisticsColumn =
  | "samples"
  | "min"
  | "max"
  | "mean"
  | "std"
  | "firstLast"
  | "changes";

export const DEFAULT_STATISTICS_COLUMNS: StatisticsColumn[] = [
  "samples",
  "min",
  "max",
  "mean",
  "std",
  "firstLast",
  "changes",
];

export interface ChartMarker {
  id: string;
  /** Time from the start of the recording, in milliseconds. */
  timeMs: number;
  label: string;
}

export interface ChartPane {
  type: "pane";
  id: string;
  title: string;
  signalIds: string[];
  normalized: boolean;
  hiddenSignalIds?: string[];
  markers?: ChartMarker[];
  // Only consulted when the dashboard's time axis is unlinked; absent means
  // this plot follows DashboardSettings.range.
  timeWindow?: TimeRange;
  // Per-plot override of DashboardSettings.enumAsBackground.
  enumDisplay?: EnumDisplay;
}

export interface ChartSplit {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  first: ChartLayout;
  second: ChartLayout;
}

export type ChartLayout = ChartPane | ChartSplit;
export type LayoutPreset = "single" | "columns" | "rows" | "grid";

export interface DashboardSettings {
  layoutState: {
    ids: string[];
    tree: ChartLayout;
    preset: LayoutPreset | null;
  };
  showStatistics: boolean;
  statisticsColumns: StatisticsColumn[];
  showOrders: boolean;
  // Dashboard-wide default for how an enum mixed with numeric series is
  // drawn; a pane can override it with ChartPane.enumDisplay.
  enumAsBackground: boolean;
  focusedId: string | null;
  units: Record<string, string>;
  timeUnit: TimeUnit;
  range: TimeRange;
  // false lets each plot hold its own window in ChartPane.timeWindow.
  linkTimeAxis: boolean;
  panelSizes: Record<string, Record<string, number>>;
}

export interface NormalDashboard {
  id: string;
  name: string;
  color: string | null;
  locked: boolean;
  selectedSeries: Record<string, boolean>;
  settings: DashboardSettings;
}

export interface DashboardTabSettings {
  name: string;
  color: string | null;
  locked: boolean;
  position: number;
}
