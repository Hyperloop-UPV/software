import type { StateCreator } from "zustand";
import { EMPTY_ARRAY } from "../../constants/emptyArray";
import type {
  WorkspaceChartConfig,
  WorkspaceChartSeries,
} from "../../types/workspace/charts";
import type { Store } from "../store";

export interface ChartsSlice {
  /** Map of WorkspaceID -> List of Charts */
  charts: Record<string, WorkspaceChartConfig[]>;

  setCharts: (charts: Record<string, WorkspaceChartConfig[]>) => void;
  getActiveWorkspaceCharts: () => WorkspaceChartConfig[];

  addChart: (workspaceId: string) => string;
  removeChart: (workspaceId: string, chartId: string) => void;
  reorderCharts: (
    workspaceId: string,
    oldIndex: number,
    newIndex: number,
  ) => void;

  addSeriesToChart: (
    workspaceId: string,
    chartId: string,
    series: WorkspaceChartSeries,
  ) => void;
  removeSeriesFromChart: (
    workspaceId: string,
    chartId: string,
    variable: string,
  ) => void;

  /** Sets new buffer size or history limit for a chart. */
  setChartHistoryLimit: (
    workspaceId: string,
    chartId: string,
    newHistoryLimit: number,
  ) => void;
}

export const createChartsSlice: StateCreator<Store, [], [], ChartsSlice> = (
  set,
  get,
) => ({
  // Telemetry Charts
  charts: {
    "workspace-1": [],
    "workspace-2": [],
    "workspace-3": [],
  },

  setCharts: (charts) => set({ charts }),

  getActiveWorkspaceCharts: () => {
    const id = get().getActiveWorkspaceId();
    if (!id) return EMPTY_ARRAY as WorkspaceChartConfig[];
    return get().charts[id] || EMPTY_ARRAY;
  },

  // Future-proofing Actions
  addChart: (workspaceId) => {
    const newChartId = crypto.randomUUID();
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: [
          ...(state.charts[workspaceId] || []),
          { id: newChartId, series: [], historyLimit: 200 },
        ],
      },
    }));
    return newChartId;
  },

  removeChart: (workspaceId, chartId) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).filter(
          (c) => c.id !== chartId,
        ),
      },
    })),

  clearCharts: () => {
    const activeWorkspaceId = get().getActiveWorkspaceId();
    if (!activeWorkspaceId) return;

    set((state) => ({
      charts: {
        ...state.charts,
        [activeWorkspaceId]: [],
      },
    }));
  },

  reorderCharts: (workspaceId, oldIndex, newIndex) => {
    if (oldIndex < 0 || newIndex < 0) return;

    set((state) => {
      const charts = [...(state.charts[workspaceId] || [])];
      const [removed] = charts.splice(oldIndex, 1);
      charts.splice(newIndex, 0, removed);
      return {
        charts: {
          ...state.charts,
          [workspaceId]: charts,
        },
      };
    });
  },

  addSeriesToChart: (workspaceId, chartId, series) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).map((c) =>
          c.id === chartId ? { ...c, series: [...c.series, series] } : c,
        ),
      },
    })),

  removeSeriesFromChart: (workspaceId, chartId, variable) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).map((c) =>
          c.id === chartId
            ? { ...c, series: c.series.filter((s) => s.variable !== variable) }
            : c,
        ),
      },
    })),

  setChartHistoryLimit: (workspaceId, chartId, newHistoryLimit) =>
    set((state) => ({
      charts: {
        ...state.charts,
        [workspaceId]: (state.charts[workspaceId] || []).map((c) =>
          c.id === chartId ? { ...c, historyLimit: newHistoryLimit } : c,
        ),
      },
    })),
});
