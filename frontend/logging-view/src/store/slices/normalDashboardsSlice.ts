import type { StateCreator } from "zustand";
import {
  appendPane,
  cloneLayout,
  createLayout,
  createPane,
  getPanes,
  nextPaneTitle,
  signalIdsInLayout,
  updatePane,
} from "../../lib/normal/layout";
import type {
  DashboardSettings,
  DashboardTabSettings,
  NormalDashboard,
} from "../../types/normal";
import { DEFAULT_STATISTICS_COLUMNS } from "../../types/normal";
import { isDiscreteMeasurement } from "../../lib/plotStudio/units";
import { MIXED_ENUM_MESSAGE } from "../../lib/normal/enums";
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
      statisticsColumns: DEFAULT_STATISTICS_COLUMNS,
      showOrders: true,
      enumAsBackground: true,
      focusedId: null,
      units: {},
      timeUnit: "s",
      range: { start: 0, end: 100 },
      linkTimeAxis: true,
      panelSizes: {},
    },
  };
}

// "Thermal" -> "Thermal (copy)" -> "Thermal (copy 2)", skipping taken names.
function copyName(name: string, taken: Set<string>): string {
  const base = name.slice(0, 80 - " (copy)".length);
  let candidate = `${base} (copy)`;
  for (let number = 2; taken.has(candidate); number++)
    candidate = `${base} (copy ${number})`;
  return candidate.slice(0, 80);
}

// A duplicated layout must not share node ids with its source: `focusedId` is
// a pane id, and `panelSizes` is keyed by split-node id with inner keys of the
// form `<splitId>-first` / `<splitId>-second` (see AnalysisWorkspace), so both
// have to be rewritten through the clone's id map.
function duplicateSettings(settings: DashboardSettings): DashboardSettings {
  const { tree, idMap } = cloneLayout(settings.layoutState.tree);
  const panelSizes = Object.fromEntries(
    Object.entries(settings.panelSizes).flatMap(([nodeId, sizes]) => {
      const next = idMap.get(nodeId);
      if (!next) return [];
      return [
        [
          next,
          Object.fromEntries(
            Object.entries(sizes).map(([panel, size]) => [
              panel.startsWith(nodeId)
                ? next + panel.slice(nodeId.length)
                : panel,
              size,
            ]),
          ),
        ],
      ];
    }),
  );
  return {
    ...settings,
    layoutState: {
      ids: signalIdsInLayout(tree),
      tree,
      preset: settings.layoutState.preset,
    },
    focusedId: settings.focusedId
      ? (idMap.get(settings.focusedId) ?? null)
      : null,
    units: { ...settings.units },
    range: { ...settings.range },
    panelSizes,
  };
}

export function initialNormalDashboards() {
  const dashboard = createDashboard();
  return {
    normalDashboards: [dashboard],
    activeNormalDashboardId: dashboard.id,
  };
}

export interface NormalDashboardsSlice {
  normalDashboards: NormalDashboard[];
  activeNormalDashboardId: string;
  addNormalDashboard: () => string;
  duplicateNormalDashboard: (id: string) => string;
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
  addNormalPlot: (signalIds?: string[]) => string;
  assignNormalSignalsToPlot: (plotId: string, signalIds: string[]) => void;
  // Transient refusal message (mixing two enums with numeric series) —
  // not persisted, cleared by the strip that shows it.
  normalPlotWarning: string | null;
  setNormalPlotWarning: (message: string | null) => void;
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
  // Reading the source only, so a locked dashboard can be duplicated; the copy
  // keeps `locked` and lands right after its original.
  duplicateNormalDashboard: (id) => {
    let copyId = "";
    set((state) => {
      const index = state.normalDashboards.findIndex(
        (dashboard) => dashboard.id === id,
      );
      if (index < 0) return state;
      const source = state.normalDashboards[index];
      const copy: NormalDashboard = {
        ...source,
        id: crypto.randomUUID(),
        name: copyName(
          source.name,
          new Set(state.normalDashboards.map((dashboard) => dashboard.name)),
        ),
        selectedSeries: { ...source.selectedSeries },
        settings: duplicateSettings(source.settings),
      };
      copyId = copy.id;
      const normalDashboards = [...state.normalDashboards];
      normalDashboards.splice(index + 1, 0, copy);
      return { normalDashboards, activeNormalDashboardId: copy.id };
    });
    return copyId;
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
      const normalizedSettings = {
        ...settings,
        layoutState: {
          ...settings.layoutState,
          ids: signalIdsInLayout(settings.layoutState.tree),
        },
      };
      return {
        normalDashboards: state.normalDashboards.map((item) =>
          item.id === id ? { ...item, settings: normalizedSettings } : item,
        ),
      };
    }),
  addNormalPlot: (signalIds = []) => {
    let plotId = "";
    set((state) => ({
      normalDashboards: state.normalDashboards.map((dashboard) => {
        if (
          dashboard.id !== state.activeNormalDashboardId ||
          dashboard.locked ||
          getPanes(dashboard.settings.layoutState.tree).length >= 8
        )
          return dashboard;
        const current = dashboard.settings.layoutState;
        const currentPanes = getPanes(current.tree);
        if (
          signalIds.length > 0 &&
          currentPanes.length === 1 &&
          currentPanes[0].signalIds.length === 0
        ) {
          plotId = currentPanes[0].id;
          const tree = updatePane(current.tree, plotId, (plot) => ({
            ...plot,
            signalIds: [...new Set(signalIds)],
          }));
          return {
            ...dashboard,
            settings: {
              ...dashboard.settings,
              layoutState: {
                ...current,
                ids: signalIdsInLayout(tree),
                tree,
              },
            },
          };
        }
        const plot = createPane(
          [...new Set(signalIds)],
          nextPaneTitle(current.tree),
        );
        plotId = plot.id;
        const tree = appendPane(current.tree, plot, current.preset);
        return {
          ...dashboard,
          settings: {
            ...dashboard.settings,
            focusedId: null,
            layoutState: {
              ids: signalIdsInLayout(tree),
              tree,
              preset: current.preset === "single" ? "grid" : current.preset,
            },
          },
        };
      }),
    }));
    return plotId;
  },
  normalPlotWarning: null,
  setNormalPlotWarning: (message) => set({ normalPlotWarning: message }),
  assignNormalSignalsToPlot: (plotId, signalIds) =>
    set((state) => {
      let refused = false;
      const discrete = (id: string) => isDiscreteMeasurement(state.adjData, id);
      return {
        normalDashboards: state.normalDashboards.map((dashboard) => {
          if (
            dashboard.id !== state.activeNormalDashboardId ||
            dashboard.locked
          )
            return dashboard;
          const current = dashboard.settings.layoutState;
          const tree = updatePane(current.tree, plotId, (plot) => {
            // A background band can only show one state at a time, so a plot
            // holds one enum next to numeric signals, or enums on their own.
            // Whatever is already in the plot stays; only arrivals that would
            // break that are turned away, one at a time.
            const accepted = [...plot.signalIds];
            for (const id of signalIds) {
              if (accepted.includes(id)) continue;
              const enums =
                accepted.filter(discrete).length + (discrete(id) ? 1 : 0);
              if (enums <= 1 || enums === accepted.length + 1)
                accepted.push(id);
              else refused = true;
            }
            return {
              ...plot,
              signalIds: accepted,
              hiddenSignalIds: plot.hiddenSignalIds?.filter(
                (id) => !signalIds.includes(id),
              ),
            };
          });
          return tree === current.tree
            ? dashboard
            : {
                ...dashboard,
                settings: {
                  ...dashboard.settings,
                  layoutState: {
                    ...current,
                    ids: signalIdsInLayout(tree),
                    tree,
                  },
                },
              };
        }),
        ...(refused ? { normalPlotWarning: MIXED_ENUM_MESSAGE } : {}),
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
          return { ...dashboard, selectedSeries };
        }),
      };
    }),
  clearNormalSeries: () =>
    set((state) => ({
      normalDashboards: state.normalDashboards.map((dashboard) =>
        dashboard.id === state.activeNormalDashboardId && !dashboard.locked
          ? { ...dashboard, selectedSeries: {} }
          : dashboard,
      ),
    })),
});
