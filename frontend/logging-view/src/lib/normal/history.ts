// Undo/redo for a dashboard's content. What is recorded is settings snapshots
// (immutable, so keeping them costs nothing); what is NOT recorded is view
// state, so zooming or panning never fills the history and undoing a plot
// change leaves the view where it is.
import { getPanes, mapPanes, signalIdsInLayout } from "./layout";
import type { ChartPane, DashboardSettings } from "../../types/normal";

export const HISTORY_LIMIT = 50;
/** Edits closer together than this merge into one step (typing, dragging). */
export const MERGE_MS = 400;

export interface DashboardHistory {
  past: DashboardSettings[];
  future: DashboardSettings[];
}

const VIEW_KEYS = new Set<keyof DashboardSettings>([
  "range",
  "cursors",
  "panelSizes",
  "focusedId",
  "showStatistics",
  "showCursors",
  "showOrders",
  "statisticsColumns",
  "timeUnit",
]);

const withoutWindow = (pane: ChartPane): ChartPane => {
  if (!pane.timeWindow) return pane;
  const rest = { ...pane };
  delete rest.timeWindow;
  return rest;
};

const contentOf = (settings: DashboardSettings) =>
  JSON.stringify(mapPanes(settings.layoutState.tree, withoutWindow));

/** True when only view state differs, i.e. nothing worth an undo step. */
export function isViewOnlyChange(
  previous: DashboardSettings,
  next: DashboardSettings,
): boolean {
  for (const key of Object.keys(next) as (keyof DashboardSettings)[]) {
    if (VIEW_KEYS.has(key) || key === "layoutState") continue;
    if (previous[key] !== next[key]) return false;
  }
  if (previous.layoutState === next.layoutState) return true;
  if (previous.layoutState.preset !== next.layoutState.preset) return false;
  return contentOf(previous) === contentOf(next);
}

/**
 * `snapshot`'s content with `current`'s view: the zoom, the panels' own
 * windows and the open panels stay as they are on screen.
 */
export function restoreContent(
  snapshot: DashboardSettings,
  current: DashboardSettings,
): DashboardSettings {
  const windows = new Map(
    getPanes(current.layoutState.tree).map((pane) => [
      pane.id,
      pane.timeWindow,
    ]),
  );
  const tree = mapPanes(snapshot.layoutState.tree, (pane) => {
    const window = windows.get(pane.id);
    const base = withoutWindow(pane);
    return window ? { ...base, timeWindow: window } : base;
  });
  const view = Object.fromEntries(
    [...VIEW_KEYS].map((key) => [key, current[key]]),
  ) as Partial<DashboardSettings>;
  const paneIds = new Set(getPanes(tree).map((pane) => pane.id));
  return {
    ...snapshot,
    ...view,
    focusedId:
      current.focusedId && paneIds.has(current.focusedId)
        ? current.focusedId
        : null,
    layoutState: {
      ...snapshot.layoutState,
      ids: signalIdsInLayout(tree),
      tree,
    },
  };
}
