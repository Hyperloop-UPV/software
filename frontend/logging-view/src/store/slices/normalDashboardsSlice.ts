import type { StateCreator } from "zustand";
import { createLayout, reconcileLayout } from "../../lib/normal/layout";
import type {
  DashboardSettings,
  DashboardTabSettings,
  NormalDashboard,
} from "../../types/normal";
import type { Store } from "../store";

function createDashboard(existing: NormalDashboard[] = []): NormalDashboard {
  const names = new Set(existing.map((dashboard) => dashboard.name));
  let name = "Dashboard";
  for (let number = 2; names.has(name); number++) name = `Dashboard ${number}`;
  return {
    id: crypto.randomUUID(),
    name,
    color: null,
    locked: false,
    selectedSeries: {},
    settings: {
      layoutState: { ids: [], tree: createLayout([], "grid"), preset: "grid" },
      showStatistics: false,
      focusedId: null,
      units: {},
      timeUnit: "s",
      range: { start: 0, end: 100 },
      panelSizes: {},
    },
  };
}

export function initialNormalDashboards() {
  const dashboard = createDashboard();
  return {
    normalDashboards: [dashboard],
    activeNormalDashboardId: dashboard.id,
  };
}

function withSelection(
  dashboard: NormalDashboard,
  selectedSeries: Record<string, boolean>,
): NormalDashboard {
  const ids = Object.keys(selectedSeries).filter((id) => selectedSeries[id]);
  const previous = dashboard.settings.layoutState;
  return {
    ...dashboard,
    selectedSeries,
    settings: {
      ...dashboard.settings,
      focusedId: null,
      layoutState: {
        ids,
        preset: previous.preset,
        tree: previous.preset
          ? createLayout(ids, previous.preset)
          : reconcileLayout(previous.tree, previous.ids, ids),
      },
    },
  };
}

export interface NormalDashboardsSlice {
  normalDashboards: NormalDashboard[];
  activeNormalDashboardId: string;
  addNormalDashboard: () => string;
  selectNormalDashboard: (id: string) => void;
  closeNormalDashboard: (id: string) => void;
  renameNormalDashboard: (id: string, name: string) => void;
  configureNormalDashboard: (
    id: string,
    settings: DashboardTabSettings,
  ) => void;
  moveNormalDashboard: (id: string, position: number) => void;
  updateNormalDashboardSettings: (
    id: string,
    update: (settings: DashboardSettings) => DashboardSettings,
  ) => void;
  toggleNormalSeries: (id: string) => void;
  clearNormalSeries: () => void;
}

export const createNormalDashboardsSlice: StateCreator<
  Store,
  [],
  [],
  NormalDashboardsSlice
> = (set) => ({
  ...initialNormalDashboards(),
  addNormalDashboard: () => {
    let id = "";
    set((state) => {
      const dashboard = createDashboard(state.normalDashboards);
      id = dashboard.id;
      return {
        normalDashboards: [...state.normalDashboards, dashboard],
        activeNormalDashboardId: id,
      };
    });
    return id;
  },
  selectNormalDashboard: (id) =>
    set((state) =>
      state.normalDashboards.some((dashboard) => dashboard.id === id)
        ? { activeNormalDashboardId: id }
        : state,
    ),
  closeNormalDashboard: (id) =>
    set((state) => {
      const index = state.normalDashboards.findIndex(
        (dashboard) => dashboard.id === id,
      );
      if (index < 0 || state.normalDashboards[index].locked) return state;
      const remaining = state.normalDashboards.filter(
        (dashboard) => dashboard.id !== id,
      );
      if (remaining.length === 0) {
        const dashboard = createDashboard();
        return {
          normalDashboards: [dashboard],
          activeNormalDashboardId: dashboard.id,
        };
      }
      return {
        normalDashboards: remaining,
        activeNormalDashboardId:
          state.activeNormalDashboardId === id
            ? remaining[Math.min(index, remaining.length - 1)].id
            : state.activeNormalDashboardId,
      };
    }),
  renameNormalDashboard: (id, name) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return;
    set((state) => ({
      normalDashboards: state.normalDashboards.map((dashboard) =>
        dashboard.id === id && !dashboard.locked
          ? { ...dashboard, name: trimmed }
          : dashboard,
      ),
    }));
  },
  configureNormalDashboard: (id, settings) =>
    set((state) => {
      const index = state.normalDashboards.findIndex(
        (dashboard) => dashboard.id === id,
      );
      if (index < 0) return state;
      const dashboard = state.normalDashboards[index];
      // A locked tab can only be edited when explicitly unlocking it.
      if (dashboard.locked && settings.locked) return state;
      const name = settings.name.trim().slice(0, 80);
      if (
        !name ||
        (settings.color !== null && !/^#[0-9a-f]{6}$/i.test(settings.color))
      )
        return state;
      const position = Number.isFinite(settings.position)
        ? Math.max(
            0,
            Math.min(
              state.normalDashboards.length - 1,
              Math.trunc(settings.position),
            ),
          )
        : index;
      const dashboards = [...state.normalDashboards];
      dashboards.splice(index, 1);
      dashboards.splice(position, 0, {
        ...dashboard,
        name,
        color: settings.color,
        locked: settings.locked,
      });
      return { normalDashboards: dashboards };
    }),
  moveNormalDashboard: (id, position) =>
    set((state) => {
      const index = state.normalDashboards.findIndex(
        (dashboard) => dashboard.id === id,
      );
      if (
        index < 0 ||
        state.normalDashboards[index].locked ||
        !Number.isFinite(position)
      )
        return state;
      const target = Math.max(
        0,
        Math.min(state.normalDashboards.length - 1, Math.trunc(position)),
      );
      if (target === index) return state;
      const dashboards = [...state.normalDashboards];
      const [dashboard] = dashboards.splice(index, 1);
      dashboards.splice(target, 0, dashboard);
      return { normalDashboards: dashboards };
    }),
  updateNormalDashboardSettings: (id, update) =>
    set((state) => {
      const dashboard = state.normalDashboards.find((item) => item.id === id);
      if (!dashboard || dashboard.locked) return state;
      const settings = update(dashboard.settings);
      if (settings === dashboard.settings) return state;
      return {
        normalDashboards: state.normalDashboards.map((item) =>
          item.id === id ? { ...item, settings } : item,
        ),
      };
    }),
  toggleNormalSeries: (id) =>
    set((state) => {
      const active = state.normalDashboards.find(
        (dashboard) => dashboard.id === state.activeNormalDashboardId,
      );
      if (!active || active.locked) return state;
      return {
        normalDashboards: state.normalDashboards.map((dashboard) => {
          if (dashboard.id !== state.activeNormalDashboardId) return dashboard;
          const selectedSeries = { ...dashboard.selectedSeries };
          if (selectedSeries[id]) delete selectedSeries[id];
          else selectedSeries[id] = true;
          return withSelection(dashboard, selectedSeries);
        }),
        ...(state.normalDashboards.find(
          (dashboard) => dashboard.id === state.activeNormalDashboardId,
        )?.settings.layoutState.ids.length === 0
          ? { isSessionPanelOpen: false }
          : {}),
      };
    }),
  clearNormalSeries: () =>
    set((state) => ({
      normalDashboards: state.normalDashboards.map((dashboard) =>
        dashboard.id === state.activeNormalDashboardId && !dashboard.locked
          ? withSelection(dashboard, {})
          : dashboard,
      ),
    })),
});
