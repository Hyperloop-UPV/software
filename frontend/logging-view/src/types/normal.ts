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

export type TimeUnit = "ms" | "s" | "min";
export const TIME_DIVISORS: Record<TimeUnit, number> = {
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

export interface ChartPane {
  type: "pane";
  id: string;
  signalIds: string[];
  normalized: boolean;
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
