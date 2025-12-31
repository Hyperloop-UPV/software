import { memo, useEffect, useRef } from "react";
import uPlot from "uplot";
import { useShallow } from "zustand/shallow";
import { COLORS } from "../../../constants/chartsColors";
import { useStore } from "../../../store/store";
import type { VariableSeries } from "../../../types/workspace/charts";
import { createTooltipPlugin } from "./tooltipPlugin";

interface ChartSurfaceProps {
  series: VariableSeries[];
  disabledIndices: Set<number>;
}

export const ChartSurface = memo(
  ({ series, disabledIndices }: ChartSurfaceProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const uplotRef = useRef<uPlot | null>(null);
    const historyRef = useRef<any[]>([]);

    const packets = useStore(
      useShallow((state) => series.map((p) => state.telemetry[p.packetId])),
    );

    // Clear history if series definition changes
    useEffect(() => {
      historyRef.current = [];
    }, [series]);

    useEffect(() => {
      if (uplotRef.current) {
        // Index in series starts at 1 because 0 is the X-axis
        series.forEach((_, i) => {
          const seriesIdx = i + 1;
          const isVisible = !disabledIndices.has(i);
          uplotRef.current?.setSeries(seriesIdx, { show: isVisible });
        });
      }
    }, [disabledIndices, series]);

    const tooltipPlugin = createTooltipPlugin(series);

    // Initialize Chart
    useEffect(() => {
      if (!containerRef.current) return;

      // Helper to get CSS variables for canvas drawing
      const getStyle = (varName: string) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue(varName)
          .trim();

      const opts: uPlot.Options = {
        width: containerRef.current.clientWidth - 32,
        height: 250,
        legend: {
          show: false,
        },
        plugins: [tooltipPlugin],
        padding: [20, 10, 5, 15],
        scales: {
          x: { time: false },
          y: {
            range: (_, min, max) => {
              if (min === max) return [min - 1, max + 1];
              const span = max - min;
              const buffer = span * 0.15;
              return [min - buffer, max + buffer];
            },
          },
        },
        series: [
          {},
          ...series.map((p, i) => ({
            label: p.variable,
            stroke: COLORS[i % COLORS.length],
            width: 2,
            points: {
              show: true,
              size: 5,
              fill: COLORS[i % COLORS.length],
              stroke: getStyle("--background"),
              width: 2,
            },
          })),
        ],
        axes: [
          {
            stroke: getStyle("--muted-foreground"),
            grid: { show: false },
            font: "10px Archivo",
            size: 20,
          },
          {
            side: 1,
            stroke: getStyle("--muted-foreground"),
            grid: { stroke: getStyle("--border") },
            font: "10px Archivo",
            size: 40,
          },
        ],
        cursor: { drag: { setScale: false, x: false, y: false } },
      };

      uplotRef.current = new uPlot(
        opts,
        [[], ...series.map(() => [])],
        containerRef.current,
      );

      return () => uplotRef.current?.destroy();
    }, [series]);

    // Update Chart Data (Runs only when 'data' actually changes)
    useEffect(() => {
      const primaryPacket = packets[0];
      if (!primaryPacket || !uplotRef.current) return;

      const snapshot = {
        count: primaryPacket.count,
        values: series.map((p, i) => {
          const pkt = packets[i];
          const m = pkt?.measurementUpdates?.[p.variable];
          if (typeof m === "boolean") return m ? 1 : 0;
          if (typeof m === "object" && m !== null && "last" in m) return m.last;
          return m ?? 0;
        }),
      };

      const lastStored = historyRef.current[historyRef.current.length - 1];
      if (!lastStored || lastStored.count !== snapshot.count) {
        historyRef.current = [...historyRef.current, snapshot].slice(-7);
        const xData = historyRef.current.map((h) => h.count);
        const yData = series.map((_, i) =>
          historyRef.current.map((h) => h.values[i]),
        );
        uplotRef.current.setData([xData, ...yData] as uPlot.AlignedData);
      }
    }, [packets, series]);

    useEffect(() => {
      if (!containerRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (uplotRef.current) {
            const { width } = entry.contentRect;

            uplotRef.current.setSize({
              width: width,
              height: 250,
            });
          }
        }
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    return <div ref={containerRef} className="h-[250px] w-full" />;
  },
);
