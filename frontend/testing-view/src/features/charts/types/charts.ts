/**
 * Workspace chart series. Chosen "lines" to be showed.
 */
export interface WorkspaceChartSeries {
  packetId: number;
  variable: string;
}

/**
 * Workspace chart configuration.
 */
export interface WorkspaceChartConfig {
  id: string;
  series: WorkspaceChartSeries[];
  /** Last n points to be kept in memory. The same thing as buffer size of the chart. */
  historyLimit: number;
}

/**
 * Checkbox state type.\
 * Indeterminate state is used when some items under the group are checked, but not all.
 */
export type CheckboxState = boolean | "indeterminate";
