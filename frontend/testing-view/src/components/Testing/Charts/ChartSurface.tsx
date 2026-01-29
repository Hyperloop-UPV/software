import { Button } from "@workspace/ui";
import { ChevronLeft, ChevronRight, X } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { memo, useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import { useShallow } from "zustand/shallow";
import { COLORS } from "../../../constants/chartsColors";
import { useStore } from "../../../store/store";
import type { VariableSeries } from "../../../types/workspace/charts";
import { createTooltipPlugin } from "./tooltipPlugin";

interface ChartSurfaceProps {
  chartId: string;
  series: VariableSeries[];
  disabledIndices: Set<number>;
}

// IMPORTANT: This component was almost completely vibe-coded
// It could provoke bugs, thus it could be improved

export const ChartSurface = memo(
  ({ chartId, series, disabledIndices }: ChartSurfaceProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const uplotRef = useRef<uPlot | null>(null);
    const historyRef = useRef<any[]>([]);

    const [isZooming, setIsZooming] = useState(false);

    const activeWorkspace = useStore((s) => s.activeWorkspace);

    const historyLimit = useStore(
      (s) =>
        s.charts[activeWorkspace?.id ?? ""]?.find((c) => c.id === chartId)
          ?.historyLimit ?? 200,
    );

    const packets = useStore(
      useShallow((state) => series.map((p) => state.telemetry[p.packetId])),
    );

    const panChart = (direction: "left" | "right") => {
      const u = uplotRef.current;
      if (!u) return;

      const xMin = u.scales.x.min!;
      const xMax = u.scales.x.max!;
      const range = xMax - xMin;
      const shift = range * 0.2;

      const latestDataCount =
        historyRef.current[historyRef.current.length - 1].count;

      let newMin, newMax;
      if (direction === "left") {
        newMin = xMin - shift;
        newMax = xMax - shift;
      } else {
        newMax = Math.min(xMax + shift, latestDataCount + shift);
        newMin = newMax - range;
      }

      u.setScale("x", { min: newMin, max: newMax });
    };

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

    const handleDoubleClick = () => {
      setIsZooming(false);
    };

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
              size: 2,
              fill: COLORS[i % COLORS.length],
              width: 0,
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
        cursor: { drag: { setScale: true, x: true, y: false } },
        hooks: {
          setSelect: [(_) => setIsZooming(true)],
        },
      };

      uplotRef.current = new uPlot(
        opts,
        [[], ...series.map(() => [])],
        containerRef.current,
      );

      containerRef.current.addEventListener("dblclick", handleDoubleClick);

      return () => {
        uplotRef.current?.destroy();
        containerRef.current?.removeEventListener(
          "dblclick",
          handleDoubleClick,
        );
      };
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
        const prevLatestCount = lastStored?.count ?? 0;

        historyRef.current = [...historyRef.current, snapshot].slice(
          -historyLimit,
        );

        const xData = historyRef.current.map((h) => h.count);
        const yData = series.map((_, i) =>
          historyRef.current.map((h) => h.values[i]),
        );

        const u = uplotRef.current;

        u.setData([xData, ...yData] as uPlot.AlignedData, !isZooming);

        if (isZooming && u) {
          const currentXMax = u.scales.x.max!;
          const currentXMin = u.scales.x.min!;

          const range = currentXMax - currentXMin;
          const shift = range * 0.2;

          // If the view was already at the "Present" before this update...
          if (currentXMax >= prevLatestCount) {
            const currentXMin = u.scales.x.min!;
            const range = currentXMax - currentXMin;
            const newMax = snapshot.count + shift;
            const newMin = newMax - range;

            u.setScale("x", { min: newMin, max: newMax });
          }
        }
      }
    }, [packets, series, isZooming]);

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

    if (series.length === 0) {
      return (
        <div className="border-muted-foreground/20 text-muted-foreground/50 flex h-[275px] w-full items-center justify-center rounded-lg border-2 border-dashed text-center">
          Add a variable here to start visualizing data
        </div>
      );
    }

    const latestCount =
      historyRef.current[historyRef.current.length - 1]?.count ?? 0;
    const currentMax = uplotRef.current?.scales.x.max ?? 0;
    const isAtEdge = currentMax >= latestCount;

    return (
      <div className="relative w-full">
        <div ref={containerRef} className="h-[250px] w-full" />
        {/* Integrated Status Bar - Pinned Top Right */}
        <div className="z-5 absolute -top-1 right-2 flex items-center gap-2">
          {/* Mode Indicator & Label */}
          {isZooming && (
            <div className="bg-background/60 border-border/50 hover:bg-background/80 flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 shadow-sm backdrop-blur-md transition-all">
              <div
                className={cn(
                  "border-border/50 flex items-center gap-2 border-r pr-2",
                )}
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isAtEdge
                      ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                      : "bg-orange-500",
                  )}
                />
                <span className="text-foreground/70 select-none text-[9px] font-black uppercase tracking-tight">
                  {isAtEdge ? "Follow-Zoom" : "Reviewing"}
                </span>
              </div>
              <button
                onClick={handleDoubleClick}
                className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded-full transition-colors"
                title="Reset View"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        {isZooming && (
          <>
            <div className="pointer-events-none absolute inset-y-0 flex w-full items-center justify-between px-2">
              <Button
                variant="secondary"
                size="icon"
                className="pointer-events-auto h-8 w-8 rounded-full opacity-70 shadow-md hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  panChart("left");
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {uplotRef.current &&
                uplotRef.current.scales.x.max! <
                  (historyRef.current[historyRef.current.length - 1]?.count ??
                    0) && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="pointer-events-auto h-8 w-8 rounded-full opacity-70 shadow-md hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      panChart("right");
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
            </div>
          </>
        )}
      </div>
    );
  },
);
