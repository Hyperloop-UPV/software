import type { Ref } from "react";
import { useImperativeHandle } from "react";
import type * as echarts from "echarts";

/** What a plot's chart offers to its pane, whatever kind of chart it is. */
export interface ChartHandle {
  /** The chart as drawn now, as a PNG on a solid background. */
  getImage: () => Promise<Blob | null>;
}

export function useChartHandle(
  ref: Ref<ChartHandle> | undefined,
  chartRef: { current: echarts.ECharts | null },
  background: string,
) {
  useImperativeHandle(
    ref,
    () => ({
      getImage: async () => {
        const chart = chartRef.current;
        if (!chart) return null;
        const url = chart.getDataURL({
          type: "png",
          pixelRatio: 2,
          backgroundColor: background,
        });
        return (await fetch(url)).blob();
      },
    }),
    [chartRef, background],
  );
}

/** The panes' own surface colours, so an export looks like the screen. */
export const chartBackground = (isDarkMode: boolean) =>
  isDarkMode ? "#21252c" : "#ffffff";
