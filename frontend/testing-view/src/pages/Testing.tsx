import {
  Badge,
  Button,
  Spinner,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@workspace/ui";
import { useState } from "react";
import { useWorkspacesStore } from "../store/useWorkspacesStore";

import { RightSidebar } from "../components/RightSidebar/RightSidebar";
import { PacketsFilterDialog } from "../components/RightSidebar/Packets/PacketsFilterDialog";
import { CommandsFilterDialog } from "../components/RightSidebar/Commands/CommandsFilterDialog";
import { ChevronLeft } from "@workspace/ui/icons";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@workspace/ui/lib";

// Mock data with different value ranges
const mockData1 = [
  { date: "2024-01-01", temperature: 20, pressure: 1013, humidity: 45 },
  { date: "2024-01-02", temperature: 22, pressure: 1015, humidity: 47 },
  { date: "2024-01-03", temperature: 25, pressure: 1012, humidity: 50 },
  { date: "2024-01-04", temperature: 23, pressure: 1014, humidity: 48 },
  { date: "2024-01-05", temperature: 21, pressure: 1016, humidity: 46 },
  { date: "2024-01-06", temperature: 24, pressure: 1011, humidity: 52 },
  { date: "2024-01-07", temperature: 26, pressure: 1013, humidity: 49 },
];

// Small range: 0-10 (percentage-like values)
const mockData2 = [
  { date: "2024-01-01", cpu: 2.5, memory: 4.2, disk: 1.8 },
  { date: "2024-01-02", cpu: 3.1, memory: 5.0, disk: 2.1 },
  { date: "2024-01-03", cpu: 1.9, memory: 3.5, disk: 1.5 },
  { date: "2024-01-04", cpu: 4.3, memory: 6.2, disk: 2.8 },
  { date: "2024-01-05", cpu: 2.8, memory: 4.8, disk: 2.0 },
  { date: "2024-01-06", cpu: 5.1, memory: 7.3, disk: 3.2 },
  { date: "2024-01-07", cpu: 3.6, memory: 5.5, disk: 2.4 },
];

// Medium range: 0-100 (percentage)
const mockData3 = [
  { date: "2024-01-01", battery: 85, signal: 92, quality: 78 },
  { date: "2024-01-02", battery: 82, signal: 88, quality: 75 },
  { date: "2024-01-03", battery: 79, signal: 95, quality: 82 },
  { date: "2024-01-04", battery: 76, signal: 90, quality: 80 },
  { date: "2024-01-05", battery: 73, signal: 87, quality: 77 },
  { date: "2024-01-06", battery: 70, signal: 93, quality: 85 },
  { date: "2024-01-07", battery: 68, signal: 89, quality: 79 },
];

// Large range: 0-1000 (voltage, current, etc.)
const mockData4 = [
  { date: "2024-01-01", voltage: 220, current: 450, power: 990 },
  { date: "2024-01-02", voltage: 225, current: 480, power: 1080 },
  { date: "2024-01-03", voltage: 218, current: 420, power: 915 },
  { date: "2024-01-04", voltage: 230, current: 500, power: 1150 },
  { date: "2024-01-05", voltage: 215, current: 440, power: 946 },
  { date: "2024-01-06", voltage: 228, current: 490, power: 1117 },
  { date: "2024-01-07", voltage: 222, current: 460, power: 1021 },
];

// Very large range: 0-10000 (counts, measurements)
const mockData5 = [
  { date: "2024-01-01", requests: 2450, responses: 2380, errors: 12 },
  { date: "2024-01-02", requests: 3120, responses: 3050, errors: 8 },
  { date: "2024-01-03", requests: 1890, responses: 1850, errors: 5 },
  { date: "2024-01-04", requests: 4560, responses: 4480, errors: 15 },
  { date: "2024-01-05", requests: 2780, responses: 2720, errors: 10 },
  { date: "2024-01-06", requests: 3890, responses: 3820, errors: 7 },
  { date: "2024-01-07", requests: 3250, responses: 3180, errors: 9 },
];

// Mixed ranges (combining different scales)
const mockData6 = [
  { date: "2024-01-01", small: 3.2, medium: 45, large: 850, huge: 3200 },
  { date: "2024-01-02", small: 4.1, medium: 52, large: 920, huge: 3800 },
  { date: "2024-01-03", small: 2.8, medium: 38, large: 780, huge: 2900 },
  { date: "2024-01-04", small: 5.3, medium: 61, large: 1100, huge: 4200 },
  { date: "2024-01-05", small: 3.7, medium: 48, large: 950, huge: 3500 },
  { date: "2024-01-06", small: 4.9, medium: 55, large: 1020, huge: 3900 },
  { date: "2024-01-07", small: 3.5, medium: 42, large: 880, huge: 3300 },
];

const charts = [
  {
    id: 1,
    title: "Environmental Data (20-26°C, 1011-1016 hPa)",
    data: mockData1,
    dataKeys: [
      { key: "temperature", name: "Temperature (°C)", color: "#8884d8" },
      { key: "pressure", name: "Pressure (hPa)", color: "#82ca9d" },
      { key: "humidity", name: "Humidity (%)", color: "#ffc658" },
    ],
  },
  {
    id: 2,
    title: "System Metrics (0-10 range)",
    data: mockData2,
    dataKeys: [
      { key: "cpu", name: "CPU Usage (%)", color: "#8884d8" },
      { key: "memory", name: "Memory (%)", color: "#82ca9d" },
      { key: "disk", name: "Disk (%)", color: "#ffc658" },
    ],
  },
  {
    id: 3,
    title: "Device Status (0-100%)",
    data: mockData3,
    dataKeys: [
      { key: "battery", name: "Battery (%)", color: "#8884d8" },
      { key: "signal", name: "Signal (%)", color: "#82ca9d" },
      { key: "quality", name: "Quality (%)", color: "#ffc658" },
    ],
  },
  // {
  //   id: 4,
  //   title: "Electrical Measurements (200-1000 range)",
  //   data: mockData4,
  //   dataKeys: [
  //     { key: "voltage", name: "Voltage (V)", color: "#8884d8" },
  //     { key: "current", name: "Current (mA)", color: "#82ca9d" },
  //     { key: "power", name: "Power (W)", color: "#ffc658" },
  //   ],
  // },
  // {
  //   id: 5,
  //   title: "Network Traffic (1000-5000 range)",
  //   data: mockData5,
  //   dataKeys: [
  //     { key: "requests", name: "Requests", color: "#8884d8" },
  //     { key: "responses", name: "Responses", color: "#82ca9d" },
  //     { key: "errors", name: "Errors", color: "#ef4444" },
  //   ],
  // },
  // {
  //   id: 6,
  //   title: "Mixed Data (0-10000 range)",
  //   data: mockData6,
  //   dataKeys: [
  //     { key: "small", name: "Small (0-10)", color: "#8884d8" },
  //     { key: "medium", name: "Medium (0-100)", color: "#82ca9d" },
  //     { key: "large", name: "Large (0-1000)", color: "#ffc658" },
  //     { key: "huge", name: "Huge (0-10000)", color: "#ef4444" },
  //   ],
  // },
];

// Custom tick component for XAxis
const CustomXAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill="currentColor"
        className="text-xs font-medium"
        style={{ fontFamily: "var(--font-archivo)" }}
      >
        {payload.value}
      </text>
    </g>
  );
};

// Custom tick component for YAxis
const CustomYAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dx={-8}
        textAnchor="end"
        fill="currentColor"
        className="text-xs font-medium"
        style={{ fontFamily: "var(--font-archivo)" }}
      >
        {payload.value}
      </text>
    </g>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card rounded-lg border p-3 shadow-md">
        <p
          className="mb-2 text-sm font-semibold"
          style={{ fontFamily: "var(--font-archivo)" }}
        >
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            className="text-xs"
            style={{
              color: entry.color,
              fontFamily: "var(--font-archivo)",
              fontWeight: 500,
            }}
          >
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom legend
const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span
            className="text-sm font-medium"
            style={{ fontFamily: "var(--font-archivo)" }}
          >
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const Chart = ({
  data,
  dataKeys,
}: {
  data: any;
  dataKeys: { key: string; name: string; color: string }[];
}) => {
  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={<CustomXAxisTick />}
            tickFormatter={(date) =>
              new Date(date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
              })
            }
            className="font-archivo text-xs"
          />
          <YAxis className="font-archivo text-xs" tick={<CustomYAxisTick />} />
          <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
          <Legend content={<CustomLegend />} />
          {dataKeys.map(({ key, name, color }) => (
            <Line
              key={key}
              isAnimationActive={false}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              name={name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const Testing = () => {
  const { activeWorkspace } = useWorkspacesStore();
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [chartColumns, setChartColumns] = useState(1);
  const [isChangingColumns, setIsChangingColumns] = useState(false);

  if (!activeWorkspace) {
    return <p>No active tab</p>;
  }

  const handleChartColumnsChange = (columns: number) => {
    setIsChangingColumns(true);
    setChartColumns(columns);
    setTimeout(() => {
      setIsChangingColumns(false);
    }, 500);
  };

  return (
    <>
      <CommandsFilterDialog />

      <PacketsFilterDialog />

      {/* Main Layout */}
      <div className="relative h-full w-full">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel
            defaultSize={isSidebarVisible ? 60 : 100}
            minSize={30}
          >
            <div className="relative flex h-full flex-col items-center overflow-y-auto">
              <div className="bg-background p-sm sticky top-0 z-10 flex w-full justify-end gap-2">
                <Button
                  onClick={() => handleChartColumnsChange(1)}
                  variant={chartColumns === 1 ? "default" : "outline"}
                  size="icon"
                >
                  1
                </Button>
                <Button
                  onClick={() => handleChartColumnsChange(2)}
                  variant={chartColumns === 2 ? "default" : "outline"}
                  size="icon"
                >
                  2
                </Button>
                {!isSidebarVisible && (
                  <Button
                    onClick={() => setIsSidebarVisible(true)}
                    className="text-foreground"
                    variant="outline"
                    size="icon"
                  >
                    <span className="text-lg">
                      <ChevronLeft className="text-foreground h-4 w-4" />
                    </span>
                  </Button>
                )}
              </div>
              <div
                className={cn(
                  "p-lg grid h-full w-full gap-4",
                  isChangingColumns && "opacity-20",
                  `grid-cols-${chartColumns}`,
                )}
              >
                {charts.map((chart) => (
                  <div className="h-[250px]">
                    <Chart
                      key={chart.id}
                      data={chart.data}
                      dataKeys={chart.dataKeys}
                    />
                  </div>
                ))}
              </div>

              <div className="absolute">Loading</div>
            </div>
          </ResizablePanel>

          {isSidebarVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={20} maxSize={70}>
                <RightSidebar onClose={() => setIsSidebarVisible(false)} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </>
  );
};
