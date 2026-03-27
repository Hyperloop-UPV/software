export type DndActiveData = DndVariableData | DndChartData;

type DndVariableData = {
  type: "variable";
  packetId: number;
  variableId: string;
  variableType: string;
  variableName: string;
  variableEnumOptions?: string[];
};

type DndChartData = {
  type: "chart";
  chartId: string;
};
