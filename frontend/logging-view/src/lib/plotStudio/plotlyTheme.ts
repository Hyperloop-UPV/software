// Plotly has no built-in dark/light theming — every color is a literal in
// `layout`. This module is the single source of truth for those colors and
// for the structural layout built from them, so the live chart (theme-
// following) and image exports (always forced light, see PlotWrapper) build
// the exact same shape from two different theme instances.
import type Plotly from "plotly.js-dist";

export interface PlotlyThemeColors {
  paperBg: string;
  plotBg: string;
  fontColor: string;
  gridColor: string;
  neutralLineColor: string;
  hoverBg: string;
  hoverBorder: string;
  hoverFontColor: string;
  legendBg: string;
  legendBorder: string;
  legendFontColor: string;
  modebar?: { bgcolor: string; color: string; activecolor: string };
}

const FONT_FAMILY = "Computer Modern, Latin Modern Math, Times New Roman, serif";

export function getPlotlyTheme(isDarkMode: boolean): PlotlyThemeColors {
  if (!isDarkMode) {
    return {
      paperBg: "white", plotBg: "white",
      fontColor: "#000000", gridColor: "#e0e0e0", neutralLineColor: "#000000",
      hoverBg: "rgba(255,255,255,0.97)", hoverBorder: "#000000", hoverFontColor: "#000000",
      legendBg: "rgba(255,255,255,0.95)", legendBorder: "#000000", legendFontColor: "#000000",
    };
  }
  return {
    paperBg: "#242424", plotBg: "#2b2b2b",
    fontColor: "#f5f5f5", gridColor: "#484848", neutralLineColor: "#d4d4d4",
    hoverBg: "rgba(43,43,43,0.97)", hoverBorder: "#5a5a5a", hoverFontColor: "#f5f5f5",
    legendBg: "rgba(36,36,36,0.96)", legendBorder: "#5a5a5a", legendFontColor: "#f5f5f5",
    modebar: { bgcolor: "rgba(36,36,36,0)", color: "#c4c4c4", activecolor: "#ff7f24" },
  };
}

export interface BuildPlotLayoutParams {
  theme: PlotlyThemeColors;
  hasFFT: boolean;
  hasLeftAxis: boolean;
  hasRightAxis: boolean;
  plotId: string;
  leftUnits: string | undefined;
  rightUnits: string | undefined;
  // Uniformly scales font sizes and line/tick widths. The live chart always
  // uses 1 (matches on-screen density); PNG export passes a larger value so
  // text reads clearly at the export's fixed pixel size (see PlotWrapper's
  // buildExportFigure).
  fontScale?: number;
  // Target export canvas height in px (e.g. 1600 for the single-plot PNG
  // export, 1000 for a PDF report's chart pages — see PDF_CHART_IMAGE_OPTS).
  // Only meaningful when fontScale !== 1. Legend "y" is a *fraction* of this
  // height, so a smaller export canvas needs a proportionally larger
  // fraction to keep the same absolute pixel gap below the x-axis title —
  // without this, a shorter canvas collides the legend into the title.
  exportHeight?: number;
  // Freezes every axis (fixedrange) so pan/zoom/scroll-zoom/box-zoom and
  // double-click-autoscale are all no-ops — the "lock plot" feature. Hover/
  // tooltips still work. Never set for export figures (always a static image).
  locked?: boolean;
}

// Absolute pixel gap (at the historical 1600px-tall single-plot PNG export)
// between the x-axis and the legend's top edge — the reference every other
// export height is scaled against so the visual gap stays constant.
const EXPORT_LEGEND_GAP_PX = 190;

export function buildPlotLayout({
  theme, hasFFT, hasLeftAxis, hasRightAxis, plotId, leftUnits, rightUnits, fontScale = 1, exportHeight = 1600, locked = false,
}: BuildPlotLayoutParams): Partial<Plotly.Layout> {
  // The live chart's plot area is only a few hundred px tall (resizable, user
  // controlled), while export renders into a fixed-height canvas — the same
  // legend "y" fraction lands at very different pixel offsets from the
  // x-axis on each, so the two need separately tuned gaps rather than one
  // value scaled by fontScale.
  const isExport = fontScale !== 1;
  const marginBottom = isExport ? 140 * fontScale : 130;
  const marginTop    = isExport ? 70 * fontScale  : 40 * fontScale;
  const marginSide   = isExport ? 1.5 : 1; // extra breathing room around the export canvas only
  const legendY = isExport ? -EXPORT_LEGEND_GAP_PX / exportHeight : -0.35;
  const base: Partial<Plotly.Layout> = {
    autosize: true,
    // Preserve zoom/pan across data changes (adding signals, stats, etc.);
    // reset only when the X-axis meaning flips between time and frequency.
    uirevision: hasFFT ? `${plotId}:fft` : plotId,
    paper_bgcolor: theme.paperBg, plot_bgcolor: theme.plotBg,
    font: { color: theme.fontColor, family: FONT_FAMILY, size: 14 * fontScale },
    // Plot title stays editable (click-to-enter placeholder); Plotly's
    // subtitle prompt is hidden via CSS (.gtitle-subtitle in index.css)
    // since there's no config flag to disable just that piece.
    title: { font: { size: 22 * fontScale } },
    xaxis: {
      title: { text: hasFFT ? "Frequency (Hz)" : "Time (ms)", font: { size: 16 * fontScale, color: theme.fontColor } },
      tickfont: { size: 14 * fontScale, color: theme.neutralLineColor },
      gridcolor: theme.gridColor, linecolor: theme.neutralLineColor, linewidth: 1.5 * fontScale, mirror: true,
      ticks: "outside", tickwidth: 1.5 * fontScale, tickcolor: theme.neutralLineColor, color: theme.neutralLineColor,
      showline: true, zeroline: false, fixedrange: locked,
      exponentformat: "power", separatethousands: true,
    },
    yaxis: hasLeftAxis
      ? {
          title: {
            text: hasRightAxis
              ? `Value (Left${leftUnits ? `, ${leftUnits}` : ""})`
              : `Value${leftUnits ? ` (${leftUnits})` : ""}`,
            font: { size: 16 * fontScale, color: theme.fontColor },
          },
          tickfont: { size: 14 * fontScale, color: theme.neutralLineColor },
          gridcolor: theme.gridColor, linecolor: theme.neutralLineColor, linewidth: 1.5 * fontScale, mirror: !hasRightAxis,
          ticks: "outside", tickwidth: 1.5 * fontScale, tickcolor: theme.neutralLineColor, color: theme.neutralLineColor,
          showline: true, zeroline: false, fixedrange: locked,
          exponentformat: "power", separatethousands: true,
        }
      : {
          // Nothing is actually plotted on the left axis (every signal is on
          // the right) — keep just its border line for a clean box, but hide
          // the numeric scale/ticks/title, which would otherwise show a
          // meaningless default [-1, 1] range with no bearing on the data.
          title: undefined,
          showticklabels: false,
          ticks: "",
          gridcolor: "transparent",
          linecolor: theme.neutralLineColor, linewidth: 1.5 * fontScale, mirror: false,
          showline: true, zeroline: false, fixedrange: true,
        },
    margin: {
      l: (hasLeftAxis ? 80 : 40) * fontScale * marginSide, r: (hasRightAxis ? 80 : 40) * fontScale * marginSide,
      t: marginTop, b: marginBottom,
    },
    // Unified hover: one label per signal at the same X — much easier to
    // compare synchronized measurements than per-point "closest" mode.
    hovermode: "x unified",
    hoverlabel: {
      bgcolor: theme.hoverBg,
      bordercolor: theme.hoverBorder,
      font: { family: FONT_FAMILY, size: 12 * fontScale, color: theme.hoverFontColor },
    },
    showlegend: true,
    legend: {
      bgcolor: theme.legendBg, bordercolor: theme.legendBorder, borderwidth: 1, font: { size: 13 * fontScale, color: theme.legendFontColor },
      orientation: "h", x: 1, xanchor: "right", y: legendY, yanchor: "top",
    },
  };
  if (theme.modebar) {
    base.modebar = theme.modebar;
  }
  if (hasRightAxis) {
    base.yaxis2 = {
      title: { text: `Value (Right${rightUnits ? `, ${rightUnits}` : ""})`, font: { size: 16 * fontScale, color: theme.fontColor } },
      tickfont: { size: 14 * fontScale, color: theme.neutralLineColor },
      // Dashed grid mirrors the dashed right-axis traces (Plotly can't dash
      // the axis border itself, only its gridlines) — visible here, unlike
      // the left axis's solid grid, so the two scales read as distinct.
      overlaying: "y", side: "right", gridcolor: theme.gridColor, griddash: "dash",
      linecolor: theme.neutralLineColor, linewidth: 1.5 * fontScale, ticks: "outside", tickwidth: 1.5 * fontScale,
      tickcolor: theme.neutralLineColor, color: theme.neutralLineColor, showline: true, zeroline: false, fixedrange: locked,
      exponentformat: "power", separatethousands: true,
    };
  }
  return base;
}

export interface BuildTimelineLayoutParams {
  theme: PlotlyThemeColors;
  plotId: string;
  rowLabels: string[]; // one per signal, top-to-bottom in assignment order
  fontScale?: number;
  // See BuildPlotLayoutParams.exportHeight.
  exportHeight?: number;
  // See BuildPlotLayoutParams.locked.
  locked?: boolean;
}

// Sibling to buildPlotLayout for the "Cronograma" (Gantt) plot mode: one
// categorical row per signal instead of a shared numeric Y axis. Reuses the
// same theme/font/margin conventions so the two modes look like the same
// app, but the shapes diverge enough (no yaxis2, no FFT/time toggle on the
// X title) that folding this into buildPlotLayout would mean more branches
// than shared code.
export function buildTimelineLayout({
  theme, plotId, rowLabels, fontScale = 1, exportHeight = 1600, locked = false,
}: BuildTimelineLayoutParams): Partial<Plotly.Layout> {
  const isExport = fontScale !== 1;
  const marginSide = isExport ? 1.5 : 1;
  const legendY = isExport ? -EXPORT_LEGEND_GAP_PX / exportHeight : -0.25;
  const base: Partial<Plotly.Layout> = {
    autosize: true,
    uirevision: `${plotId}:timeline`,
    paper_bgcolor: theme.paperBg, plot_bgcolor: theme.plotBg,
    font: { color: theme.fontColor, family: FONT_FAMILY, size: 14 * fontScale },
    title: { font: { size: 22 * fontScale } },
    barmode: "stack",
    xaxis: {
      title: { text: "Time (ms)", font: { size: 16 * fontScale, color: theme.fontColor } },
      tickfont: { size: 14 * fontScale, color: theme.neutralLineColor },
      gridcolor: theme.gridColor, linecolor: theme.neutralLineColor, linewidth: 1.5 * fontScale, mirror: true,
      ticks: "outside", tickwidth: 1.5 * fontScale, tickcolor: theme.neutralLineColor, color: theme.neutralLineColor,
      showline: true, zeroline: false, fixedrange: locked,
    },
    yaxis: {
      type: "category",
      categoryarray: rowLabels,
      autorange: "reversed", // first-assigned signal on top, Gantt convention
      tickfont: { size: 14 * fontScale, color: theme.neutralLineColor },
      gridcolor: theme.gridColor, linecolor: theme.neutralLineColor, linewidth: 1.5 * fontScale,
      showline: true, zeroline: false, fixedrange: true,
    },
    margin: {
      l: 120 * fontScale * marginSide, r: 40 * fontScale * marginSide,
      t: (isExport ? 70 : 40) * fontScale, b: (isExport ? 140 : 60) * fontScale,
    },
    hovermode: "closest",
    hoverlabel: {
      bgcolor: theme.hoverBg,
      bordercolor: theme.hoverBorder,
      font: { family: FONT_FAMILY, size: 12 * fontScale, color: theme.hoverFontColor },
    },
    showlegend: true,
    legend: {
      bgcolor: theme.legendBg, bordercolor: theme.legendBorder, borderwidth: 1, font: { size: 13 * fontScale, color: theme.legendFontColor },
      orientation: "h", x: 1, xanchor: "right", y: legendY, yanchor: "top",
    },
  };
  if (theme.modebar) {
    base.modebar = theme.modebar;
  }
  return base;
}
