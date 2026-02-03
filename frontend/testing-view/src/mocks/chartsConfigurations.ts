import type { WorkspaceChartConfig } from "../types/workspace/charts";

export const MOCK_CHARTS: Record<string, WorkspaceChartConfig[]> = {
  "workspace-1": [
    {
      id: "ws1-chart-1",
      series: [
        { packetId: 252, variable: "regulator_1_pressure" },
        { packetId: 252, variable: "regulator_2_pressure" },
      ],
      historyLimit: 1000,
    },
    {
      id: "ws1-chart-2",
      series: [
        { packetId: 318, variable: "lcu_airgap_1" },
        { packetId: 318, variable: "lcu_airgap_2" },
        { packetId: 318, variable: "lcu_airgap_3" },
        { packetId: 318, variable: "lcu_airgap_4" },
        { packetId: 318, variable: "lcu_airgap_5" },
      ],
      historyLimit: 3000,
    },
    {
      id: "ws1-chart-3",
      series: [{ packetId: 779, variable: "frequency" }],
      historyLimit: 200,
    },
  ],
  "workspace-2": [],
  "workspace-3": [
    {
      id: "ws3-chart-1",
      series: [{ packetId: 252, variable: "regulator_3_pressure" }],
      historyLimit: 500,
    },
    {
      id: "ws3-chart-2",
      series: [{ packetId: 252, variable: "regulator_4_pressure" }],
      historyLimit: 1100,
    },
  ],
};
