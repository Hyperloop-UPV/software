/** Maximum number of data points kept per chart series. */
export const CHART_MAX_POINTS = 500;

/** Default rendered height of a chart in pixels. */
export const CHART_HEIGHT = 220;

/** Stroke width for chart lines. */
export const CHART_LINE_WIDTH = 2;

/** Diameter of the dot drawn at each data point. */
export const CHART_POINT_SIZE = 2;

/** Colour palette — one entry per series (competition orange first). */
export const CHART_COLORS = [
  "#ff7f24", // primary orange
  "#2563eb", // blue
  "#10b981", // green
  "#ef4444", // red
  "#8b5cf6", // purple
] as const;
