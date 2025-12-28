import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useStore } from "../../store/store";
import { useShallow } from "zustand/shallow";
import { Trash2, X } from "@workspace/ui/icons";

interface MeasurementPoint {
  packetId: number;
  variable: string;
}

const COLORS = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

export const TelemetryChart = ({
  id,
  points,
}: {
  id: string;
  points: MeasurementPoint[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const historyRef = useRef<any[]>([]);

  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId());
  const removeChart = useStore((s) => s.removeChart);
  const removeSeries = useStore((s) => s.removeSeriesFromChart);

  const [disabledIndices, setDisabledIndices] = useState<Set<number>>(
    new Set(),
  );

  const packets = useStore(
    useShallow((state) => points.map((p) => state.telemetry[p.packetId])),
  );

  const toggleSeries = (index: number) => {
    setDisabledIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const tooltipPlugin = () => {
    let tooltip: HTMLDivElement;
    return {
      hooks: {
        init: (u: uPlot) => {
          tooltip = document.createElement("div");
          Object.assign(tooltip.style, {
            display: "none",
            position: "absolute",
            background: "#fff",
            border: "1px solid #e2e8f0",
            padding: "8px 12px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            pointerEvents: "none",
            zIndex: "100",
            fontSize: "11px",
            fontFamily: "Archivo, sans-serif",
          });
          u.root.querySelector(".u-over")?.appendChild(tooltip);
        },
        setCursor: (u: uPlot) => {
          const { left, top, idx } = u.cursor;
          if (
            idx === null ||
            left === undefined ||
            top === undefined ||
            idx === undefined
          ) {
            tooltip.style.display = "none";
            return;
          }

          tooltip.style.display = "block";

          const chartWidth = u.bbox.width;
          if (left > chartWidth * 0.65) {
            // Place to the left of the cursor
            tooltip.style.left = left - tooltip.offsetWidth - 20 + "px";
          } else {
            // Place to the right of the cursor (default)
            tooltip.style.left = left + 20 + "px";
          }

          tooltip.style.top = top - 40 + "px";

          let html = `<div style="color: #64748b; font-weight: bold; font-size: 9px; margin-bottom: 4px;">PACKET #${u.data[0][idx]}</div>`;
          points.forEach((p, i) => {
            const val = u.data[i + 1][idx];
            html += `
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 2px;">
                <span style="color: #64748b;">${p.variable}:</span>
                <span style="color: ${COLORS[i % COLORS.length]}; font-weight: bold;">${val?.toFixed(2)}</span>
              </div>
            `;
          });
          tooltip.innerHTML = html;
        },
      },
    };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth - 32,
      height: 250,
      legend: {
        show: false,
      },
      plugins: [tooltipPlugin()],
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
        ...points.map((p, i) => ({
          label: p.variable,
          stroke: COLORS[i % COLORS.length],
          width: 2,
          points: {
            show: true,
            size: 5,
            fill: COLORS[i % COLORS.length],
            stroke: "#fff",
            width: 2,
          },
        })),
      ],
      axes: [
        {
          stroke: "#94a3b8",
          grid: { show: false },
          font: "10px Archivo",
          size: 20,
        },
        {
          side: 1,
          stroke: "#94a3b8",
          grid: { stroke: "#f1f5f9" },
          font: "10px Archivo",
          size: 50,
        },
      ],
      cursor: { drag: { setScale: false } },
    };

    uplotRef.current = new uPlot(
      opts,
      [[], ...points.map(() => [])],
      containerRef.current,
    );

    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
    };
  }, [points]);

  useEffect(() => {
    if (uplotRef.current) {
      // Index in series starts at 1 because 0 is the X-axis
      points.forEach((_, i) => {
        const seriesIdx = i + 1;
        const isVisible = !disabledIndices.has(i);
        uplotRef.current?.setSeries(seriesIdx, { show: isVisible });
      });
    }
  }, [disabledIndices, points]);

  useEffect(() => {
    const primaryPacket = packets[0];
    if (!primaryPacket || !uplotRef.current) return;

    const snapshot = {
      count: primaryPacket.count,
      values: points.map((p, i) => {
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
      const yData = points.map((_, i) =>
        historyRef.current.map((h) => h.values[i]),
      );
      uplotRef.current.setData([xData, ...yData] as uPlot.AlignedData);
    }
  }, [packets, points]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (uplotRef.current) {
          // Subtract padding from the container width to fit exactly
          const { width } = entry.contentRect;

          // uPlot.setSize is extremely fast and doesn't require a React re-render
          uplotRef.current.setSize({
            width: width - 32, // Adjust '32' to match your padding (p-4 = 1rem each side)
            height: 250, // Keep your fixed height or adjust as needed
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative h-full w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {/* Remove entire chart button (visible on hover) */}
      <button
        onClick={() => activeWorkspaceId && removeChart(activeWorkspaceId, id)}
        className="text-foreground absolute right-3 top-3 z-10 p-1 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-2 pr-8">
        {points.map((p, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => toggleSeries(i)}
              className={`flex items-center gap-1.5 rounded-l-md border px-2.5 py-1 transition-all ${
                disabledIndices.has(i)
                  ? "bg-slate-100 opacity-50 grayscale"
                  : "bg-slate-50/50"
              }`}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-[10px] font-bold uppercase">
                {p.variable}
              </span>
            </button>

            {/* Remove individual variable button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                activeWorkspaceId &&
                  removeSeries(activeWorkspaceId, id, p.variable);
              }}
              className="flex h-full items-center rounded-r-md border-y border-r px-1.5 py-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
