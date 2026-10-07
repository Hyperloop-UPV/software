// Shared types for the Plot Studio (simple mode).
// All signal data — whether from CSV files, math operations, or transforms —
// is normalized into SeriesData so the rest of the app can treat them uniformly.

/**
 * Structure-of-arrays sample set: time (ms, normalized to start at 0) and
 * value, always equal length. Typed arrays avoid per-sample object overhead
 * for logging sessions that easily reach hundreds of thousands of points,
 * and Plotly.js's Data.x/y accept them directly with no copy needed.
 */
export interface SeriesData {
  time: Float64Array;
  value: Float64Array;
}

/** A loaded CSV file, stored as parsed series data alongside display metadata. */
export interface FileSignal {
  name: string;
  data: SeriesData;
  pointCount: number;
}

/** The four binary math operations supported between two signals. */
export type OperationType = "subtract" | "add" | "multiply" | "divide";

/**
 * A calculated signal produced by applying a binary operation to two source signals.
 * The result data is pre-computed at creation time and stored; it is NOT recomputed
 * when source signals change (sources are immutable once loaded).
 */
export interface Operation {
  id: string;
  name: string;
  type: OperationType;
  signalA: string; // signalId of source A
  signalB: string; // signalId of source B
  data: SeriesData;
}

/**
 * A calculated signal produced by applying a user-defined f(x) expression to one source.
 * Expression is stored as a string and evaluated via safeEval at creation time.
 */
export interface Transform {
  id: string;
  name: string;
  sourceSignal: string; // signalId of the source
  expression: string;   // e.g. "2*x", "sin(x)", "x^2"
  data: SeriesData;
}

/** Assignment of a signal to a specific plot, including display options. */
export interface PlotSignal {
  signalId: string;
  yAxis: "left" | "right"; // which Y axis to plot against
  color?: string;           // user-picked trace color override; falls back to the palette by colorIndex
  colorIndex: number;       // palette slot assigned at add-time; stable across removal of other signals
}

/** A named plot containing an ordered list of signal assignments. */
export interface PlotState {
  id: string;   // DOM element ID ("plot_0", "plot_1", …)
  name: string;
  signals: PlotSignal[];
  hidden?: boolean; // if true, skipped in PlotsArea but still managed in the sidebar list
  // Per-plot, not per-signal — FFT and time-domain traces can't coexist on
  // one plot (they'd need incompatible X-axis semantics on the same axis).
  showFFT: boolean;
  nextColorIndex: number; // monotonically increasing; never reused, so colors don't reshuffle on removal
  /** Order event ids hidden only on this plot. Missing ids remain visible. */
  hiddenOrderIds?: Record<string, true>;
  // When true, blocks pan/zoom/scroll-zoom, drag-to-resize, inline rename and
  // signal drops onto this plot, so the view can't be changed by accident.
  locked?: boolean;
}

/** Summary statistics for a signal over a time range. */
export interface NoiseStats {
  count: number;
  mean: number;
  std: number;
  rms: number;
  min: number;
  max: number;
  peakToPeak: number;
  variance: number;
}

/** Estimated noise floor: the average std-dev of the lowest-variance windows in the signal. */
export interface NoiseFloor {
  noiseFloor: number;
}
