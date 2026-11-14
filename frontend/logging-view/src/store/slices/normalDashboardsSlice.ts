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
import {
  restoreContent,
  type DashboardHistory,
} from "../../lib/normal/history";
import {
  loadSessionDashboards,
  parseDashboardFile,
  restoreDashboard,
} from "../../lib/normal/dashboardStorage";
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
      formulas: [],
      showCursors: false,
      cursors: { a: null, b: null },
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
    formulas: settings.formulas.map((formula) => ({
      ...formula,
      variables: { ...formula.variables },
    })),
    cursors: { ...settings.cursors },
  };
}

export function initialNormalDashboards() {
  const dashboard = createDashboard();
  return {
    normalDashboards: [dashboard],
    activeNormalDashboardId: dashboard.id,
  };
}

const seriesLookup = (availableSeries: Record<string, string[]>) => {
  const ids = new Set(
    Object.entries(availableSeries).flatMap(([board, measurements]) =>
      measurements.map((measurement) => `${board}/${measurement}`),
    ),
  );
  return (id: string) => ids.has(id);
};

/**
 * The dashboards to start a session with: the ones saved the last time this
 * folder was open, or a blank one.
 */
export function sessionNormalDashboards(
  folderName: string,
  availableSeries: Record<string, string[]>,
) {
  const saved = loadSessionDashboards(folderName);
  if (!saved) return initialNormalDashboards();
  const hasSeries = seriesLookup(availableSeries);
  const seen = new Set<string>();
  const dashboards: NormalDashboard[] = [];
  for (const raw of saved.dashboards) {
    const restored = restoreDashboard(
      raw,
      createDashboard(dashboards),
      hasSeries,
    );
    if (!restored || seen.has(restored.dashboard.id)) continue;
    seen.add(restored.dashboard.id);
    dashboards.push(restored.dashboard);
  }
  if (dashboards.length === 0) return initialNormalDashboards();
  return {
    normalDashboards: dashboards,
    activeNormalDashboardId: seen.has(saved.activeId)
      ? saved.activeId
      : dashboards[0].id,
  };
}

/**
 * The plot a quick add (double-click in the sidebar, the search box) lands
 * in: the last plot clicked, else the expanded one, else the first empty one,
 * else the first one.
 */
export function targetPaneId(
  dashboard: NormalDashboard,
  activePaneId: string | null,
): string | null {
  const panes = getPanes(dashboard.settings.layoutState.tree);
  const exists = (id: string | null) =>
    !!id && panes.some((pane) => pane.id === id);
  if (exists(activePaneId)) return activePaneId;
  if (exists(dashboard.settings.focusedId)) return dashboard.settings.focusedId;
  return (
    (panes.find((pane) => pane.signalIds.length === 0) ?? panes[0])?.id ?? null
  );
}

/** Set while undo/redo writes, so the history subscriber does not record it. */
export const historyReplay = { active: false };

export interface FormulaEditorRequest {
  /** Edit this formula; absent creates a new one. */
  formulaId?: string;
  /** Plot the new formula should land in by default. */
  paneId?: string;
  /** Measurements pre-bound to a, b, c… for a new formula. */
  sourceIds?: string[];
}

export interface NormalDashboardsSlice {
  normalDashboards: NormalDashboard[];
  activeNormalDashboardId: string;
  addNormalDashboard: () => string;
  duplicateNormalDashboard: (id: string) => string;
  /** Adds the dashboard in an exported file as a new tab; false if invalid. */
  importNormalDashboard: (fileText: string) => boolean;
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
  // Transient: which formula the shared dialog is editing. The toolbar and
  // the plots live in sibling trees, so the request travels through here.
  normalFormulaEditor: FormulaEditorRequest | null;
  /** Last plot the user clicked; where quick adds go. Not persisted. */
  normalActivePaneId: string | null;
  setNormalActivePaneId: (id: string | null) => void;
  /** Adds measurements to the target plot of the active dashboard. */
  addToTargetNormalPlot: (signalIds: string[]) => void;
  /** Per dashboard; recorded by the subscriber in store.ts. Not persisted. */
  normalHistory: Record<string, DashboardHistory>;
  undoNormalDashboard: (id: string) => void;
  redoNormalDashboard: (id: string) => void;
  normalSignalSearchOpen: boolean;
  setNormalSignalSearchOpen: (open: boolean) => void;
  openNormalFormulaEditor: (request?: FormulaEditorRequest) => void;
  closeNormalFormulaEditor: () => void;
  toggleNormalSeries: (id: string) => void;
  clearNormalSeries: () => void;
}

export const createNormalDashboardsSlice: StateCreator<
  Store,
  [],
  [],
  NormalDashboardsSlice
> = (set, get) => {
  // Undo takes from `past` and gives the current state to `future`; redo is
  // the same move the other way round.
  const step = (
    id: string,
    from: keyof DashboardHistory,
    to: keyof DashboardHistory,
  ) => {
    const state = get();
    const dashboard = state.normalDashboards.find((item) => item.id === id);
    const history = state.normalHistory[id];
    const snapshot = history?.[from][history[from].length - 1];
    if (!dashboard || dashboard.locked || !history || !snapshot) return;
    historyReplay.active = true;
    set({
      normalDashboards: state.normalDashboards.map((item) =>
        item.id === id
          ? { ...item, settings: restoreContent(snapshot, item.settings) }
          : item,
      ),
      normalHistory: {
        ...state.normalHistory,
        [id]: {
          ...history,
          [from]: history[from].slice(0, -1),
          [to]: [...history[to], dashboard.settings],
        } as DashboardHistory,
      },
    });
    historyReplay.active = false;
  };
  return {
    ...initialNormalDashboards(),
    importNormalDashboard: (fileText) => {
      const state = get();
      const defaults = createDashboard(state.normalDashboards);
      const file = parseDashboardFile(fileText);
      const restored = file
        ? restoreDashboard(file, defaults, seriesLookup(state.availableSeries))
        : null;
      if (!restored) {
        set({ normalPlotWarning: "That file is not an exported dashboard." });
        return false;
      }
      const taken = new Set(state.normalDashboards.map((item) => item.name));
      let name = restored.dashboard.name;
      for (let number = 2; taken.has(name); number++)
        name = `${restored.dashboard.name.slice(0, 74)} (${number})`;
      const dashboard: NormalDashboard = {
        ...restored.dashboard,
        // Fresh ids throughout: the same file can be imported more than once.
        id: defaults.id,
        name,
        locked: false,
        selectedSeries: {},
        settings: duplicateSettings(restored.dashboard.settings),
      };
      set({
        normalDashboards: [...state.normalDashboards, dashboard],
        activeNormalDashboardId: dashboard.id,
        ...(restored.dropped > 0
          ? {
              normalPlotWarning: `${restored.dropped} measurement${restored.dropped === 1 ? "" : "s"} of the imported dashboard ${restored.dropped === 1 ? "is" : "are"} not in this session and ${restored.dropped === 1 ? "was" : "were"} left out.`,
            }
          : {}),
      });
      return true;
    },
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
    normalFormulaEditor: null,
    normalActivePaneId: null,
    setNormalActivePaneId: (id) =>
      get().normalActivePaneId === id
        ? undefined
        : set({ normalActivePaneId: id }),
    addToTargetNormalPlot: (signalIds) => {
      const state = get();
      const dashboard = state.normalDashboards.find(
        (item) => item.id === state.activeNormalDashboardId,
      );
      if (!dashboard || dashboard.locked || signalIds.length === 0) return;
      const target = targetPaneId(dashboard, state.normalActivePaneId);
      if (target) state.assignNormalSignalsToPlot(target, signalIds);
    },
    normalHistory: {},
    undoNormalDashboard: (id) => step(id, "past", "future"),
    redoNormalDashboard: (id) => step(id, "future", "past"),
    normalSignalSearchOpen: false,
    setNormalSignalSearchOpen: (open) => set({ normalSignalSearchOpen: open }),
    openNormalFormulaEditor: (request = {}) =>
      set({ normalFormulaEditor: request }),
    closeNormalFormulaEditor: () => set({ normalFormulaEditor: null }),
    assignNormalSignalsToPlot: (plotId, signalIds) =>
      set((state) => {
        let refused = false;
        const discrete = (id: string) =>
          isDiscreteMeasurement(state.adjData, id);
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
            if (dashboard.id !== state.activeNormalDashboardId)
              return dashboard;
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
  };
};
