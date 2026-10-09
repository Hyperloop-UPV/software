// A session-wide view of command events. Orders are not telemetry series, so
// they live in the sidebar footer and open their own time-oriented view.
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@workspace/ui/components";
import { Send } from "@workspace/ui/icons";
import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";
import { formatOrderAnnotation } from "../../lib/orders";
import { useStore } from "../../store/store";

interface OrderPoint {
  id: string;
  value: [number, string];
  from: string;
  to: string;
  annotation: string;
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const routeColumnWidth = (chartWidth: number) => Math.min(220, Math.max(120, Math.round(chartWidth * 0.28)));
const describeParameters = (parameters: Record<string, unknown> | null) =>
  parameters && Object.keys(parameters).length > 0
    ? Object.entries(parameters).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join(" · ")
    : "No parameters";

function OrdersTimelineChart() {
  const orders = useStore((s) => s.orders);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const rangeRef = useRef({ start: 0, end: 100 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? orders[0];
  const routeCount = new Set(orders.map((order) => `${order.from} → ${order.to}`)).size;

  const zoom = (factor: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const { start, end } = rangeRef.current;
    const width = Math.min(100, Math.max(1, (end - start) * factor));
    const midpoint = (start + end) / 2;
    const nextStart = Math.max(0, Math.min(100 - width, midpoint - width / 2));
    chart.dispatchAction({ type: "dataZoom", start: nextStart, end: nextStart + width });
  };

  const resetZoom = () => {
    chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const chart = echarts.init(element);
    chartRef.current = chart;
    const updateRange = () => {
      const current = (chart.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> }).dataZoom?.[0];
      if (current?.start !== undefined && current.end !== undefined) {
        rangeRef.current = { start: current.start, end: current.end };
      }
    };
    chart.on("datazoom", updateRange);
    const selectOrder = (params: { data?: unknown }) => {
      const point = params.data as OrderPoint | undefined;
      if (point?.id) setSelectedId(point.id);
    };
    chart.on("click", selectOrder);
    const observer = new ResizeObserver(() => {
      const labelSpace = routeColumnWidth(element.clientWidth);
      chart.setOption({ grid: { left: labelSpace }, yAxis: { axisLabel: { width: labelSpace - 30 } } });
      chart.resize();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.off("datazoom", updateRange);
      chart.off("click", selectOrder);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const rows = [...new Set(orders.map((order) => `${order.from} → ${order.to}`))];
    const points: OrderPoint[] = orders.map((order) => ({
      id: order.id,
      value: [order.time, `${order.from} → ${order.to}`],
      from: order.from,
      to: order.to,
      annotation: formatOrderAnnotation(order.name, order.parameters),
    }));
    const text = isDarkMode ? "#f9fafb" : "#111827";
    const grid = isDarkMode ? "#383838" : "#e5e7eb";
    const background = isDarkMode ? "#181818" : "#ffffff";
    const labelSpace = routeColumnWidth(elementRef.current?.clientWidth ?? 0);

    chart.setOption({
      backgroundColor: "transparent",
      animation: false,
      grid: { left: labelSpace, right: 28, top: 16, bottom: 56 },
      tooltip: {
        trigger: "item",
        backgroundColor: isDarkMode ? "rgba(24,24,24,0.96)" : "rgba(255,255,255,0.98)",
        borderColor: grid,
        textStyle: { color: text },
        formatter: (params: { data: unknown }) => {
          const point = params.data as OrderPoint;
          return `${point.annotation}<br/>From: ${escapeHtml(point.from)}<br/>To: ${escapeHtml(point.to)}<br/>Time: ${point.value[0].toFixed(0)} ms`;
        },
      },
      xAxis: {
        type: "value",
        name: "Time (ms)",
        nameLocation: "middle",
        nameGap: 34,
        nameTextStyle: { color: isDarkMode ? "#a1a1aa" : "#6b7280" },
        axisLine: { lineStyle: { color: grid } },
        axisLabel: { color: isDarkMode ? "#a1a1aa" : "#6b7280", hideOverlap: true },
        splitLine: { lineStyle: { color: grid, type: "dashed", opacity: 0.7 } },
      },
      yAxis: {
        type: "category",
        data: rows,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: text, width: labelSpace - 30, overflow: "truncate", margin: 12 },
        splitLine: { show: false },
        splitArea: { show: true, areaStyle: { color: ["transparent", isDarkMode ? "#202020" : "#f8fafc"] } },
      },
      dataZoom: [{ type: "inside", xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false }],
      series: [{
        type: "scatter",
        data: points,
        symbolSize: 13,
        itemStyle: { color: "#ff7f0e", borderColor: background, borderWidth: 2 },
        emphasis: { scale: 1.3 },
      }],
    }, true);
  }, [orders, isDarkMode]);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
        <div>
          <h3 className="text-foreground text-sm font-semibold">Execution timeline</h3>
          <p className="text-muted-foreground text-xs">Wheel to zoom · drag to move · select a marker for details</p>
        </div>
        <div className="flex items-center gap-1" aria-label="Timeline zoom controls">
          <Button type="button" variant="outline" size="sm" onClick={() => zoom(0.5)} aria-label="Zoom in timeline">+</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => zoom(2)} aria-label="Zoom out timeline">−</Button>
          <Button type="button" variant="outline" size="sm" onClick={resetZoom}>Reset view</Button>
        </div>
      </div>
      <div className="text-muted-foreground w-[236px] px-4 pt-3 text-right text-[11px] font-semibold uppercase tracking-wide">From → To</div>
      <div ref={elementRef} className="w-full" style={{ height: `min(60vh, ${Math.min(540, Math.max(300, 160 + routeCount * 70))}px)` }} />
      {selectedOrder && (
        <div className="bg-muted/30 flex flex-wrap items-start gap-x-5 gap-y-1 rounded-md border px-4 py-3 text-xs">
          <div className="min-w-0 flex-1">
            <p className="text-foreground font-semibold">{selectedOrder.name}</p>
            <p className="text-muted-foreground mt-0.5 break-words">
              {selectedOrder.from} → {selectedOrder.to} · {describeParameters(selectedOrder.parameters)}
            </p>
          </div>
          <span className="text-muted-foreground shrink-0 font-mono tabular-nums">{selectedOrder.time.toLocaleString()} ms</span>
        </div>
      )}
    </div>
  );
}

function OrdersTimelineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const orders = useStore((s) => s.orders);
  const routeCount = new Set(orders.map((order) => `${order.from} → ${order.to}`)).size;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        style={{ width: "min(92vw, 72rem)", maxWidth: "calc(100vw - 2rem)" }}
      >
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 text-primary flex size-7 items-center justify-center rounded">
              <Send className="size-3.5" />
            </div>
            <DialogTitle>Orders</DialogTitle>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {orders.length} command event{orders.length !== 1 && "s"} across {routeCount} route{routeCount !== 1 && "s"}
          </p>
        </DialogHeader>
        {orders.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <OrdersTimelineChart />
          </div>
        ) : (
          <div className="text-muted-foreground flex h-52 items-center justify-center px-6 text-center text-sm">
            No orders were recorded in this session.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function OrdersTimelineControl() {
  const [open, setOpen] = useState(false);
  const ordersCount = useStore((s) => s.orders.length);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Open orders timeline" onClick={() => setOpen(true)}>
            <Send />
            <span>Orders</span>
          </SidebarMenuButton>
          {ordersCount > 0 && (
            <SidebarMenuBadge className="bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
              {ordersCount}
            </SidebarMenuBadge>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
      <OrdersTimelineModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
