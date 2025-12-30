export const MOCK_CHARTS = {
  "workspace-1": [
    {
      id: "ws1-chart-1",
      series: [
        { packetId: 252, variable: "regulator_1_pressure" },
        { packetId: 252, variable: "regulator_2_pressure" },
      ],
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
    },
    {
      id: "ws1-chart-3",
      series: [{ packetId: 779, variable: "frequency" }],
    },
  ],
  "workspace-2": [],
  "workspace-3": [
    {
      id: "ws3-chart-1",
      series: [{ packetId: 252, variable: "regulator_3_pressure" }],
    },
    {
      id: "ws3-chart-2",
      series: [{ packetId: 252, variable: "regulator_4_pressure" }],
    },
  ],
};
