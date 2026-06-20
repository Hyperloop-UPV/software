import { COLORS } from "../constants/chartsColors";
import type { WorkspaceChartSeries } from "../types/charts";

/**
 * Pins a small badge with each series' latest value to the right edge of
 * the chart, at the height matching that series' current y position.
 *
 * `hiddenLabelsRef` is read on every draw, so toggling which series show a
 * value label doesn't require recreating the uPlot instance.
 */
export const createValueLabelsPlugin = (
  series: WorkspaceChartSeries[],
  hiddenLabelsRef: { current: Set<string> },
) => {
  let labels: HTMLDivElement[];

  return {
    hooks: {
      init: (u: uPlot) => {
        labels = series.map((_, i) => {
          const label = document.createElement("div");
          label.className =
            "pointer-events-none absolute z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-sm px-1 py-0.5 text-[9px] font-bold tabular-nums text-white shadow-sm";
          label.style.background = COLORS[i % COLORS.length];
          label.style.right = "2px";
          u.root.querySelector(".u-over")?.appendChild(label);
          return label;
        });
      },
      destroy: () => labels?.forEach((label) => label.remove()),
      draw: (u: uPlot) => {
        series.forEach((p, i) => {
          const label = labels[i];
          const seriesIdx = i + 1;
          const data = u.data[seriesIdx];

          if (
            !u.series[seriesIdx]?.show ||
            hiddenLabelsRef.current.has(p.variable) ||
            !data?.length
          ) {
            label.classList.add("hidden");
            return;
          }

          let rawVal: number | null | undefined;
          for (let j = data.length - 1; j >= 0; j--) {
            if (data[j] != null) {
              rawVal = data[j];
              break;
            }
          }

          if (rawVal == null) {
            label.classList.add("hidden");
            return;
          }

          const top = u.valToPos(rawVal, "y");
          if (
            top == null ||
            Number.isNaN(top) ||
            top < 0 ||
            top > u.over.clientHeight
          ) {
            label.classList.add("hidden");
            return;
          }

          label.textContent = p.enumOptions?.length
            ? (p.enumOptions[Math.round(rawVal)] ?? String(rawVal))
            : rawVal.toFixed(2);

          label.style.top = `${top}px`;
          label.classList.remove("hidden");
        });
      },
    },
  };
};
