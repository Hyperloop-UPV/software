import type { WorkspaceChartSeries } from "../types/charts";

/**
 * Writes each series' latest value into the corresponding legend element
 * (registered by `ChartLegend` in `valueLabelRefs`), instead of touching
 * React state on every draw.
 *
 * `visibleLabelsRef` is read on every draw, so toggling which series show a
 * value in the legend doesn't require recreating the uPlot instance. Value
 * labels are opt-in, so a series only renders one once it's in the set.
 */
export const createValueLabelsPlugin = (
  series: WorkspaceChartSeries[],
  visibleLabelsRef: { current: Set<string> },
  valueLabelRefs: { current: Map<string, HTMLElement> },
) => ({
  hooks: {
    draw: (u: uPlot) => {
      series.forEach((p, i) => {
        const el = valueLabelRefs.current.get(p.variable);
        if (!el) return;

        const seriesIdx = i + 1;
        const data = u.data[seriesIdx];

        if (
          !u.series[seriesIdx]?.show ||
          !visibleLabelsRef.current.has(p.variable) ||
          !data?.length
        ) {
          el.textContent = "";
          return;
        }

        let rawVal: number | null | undefined;
        for (let j = data.length - 1; j >= 0; j--) {
          if (data[j] != null) {
            rawVal = data[j];
            break;
          }
        }

        el.textContent =
          rawVal == null
            ? ""
            : p.enumOptions?.length
              ? (p.enumOptions[Math.round(rawVal)] ?? String(rawVal))
              : rawVal.toFixed(2);
      });
    },
  },
});
