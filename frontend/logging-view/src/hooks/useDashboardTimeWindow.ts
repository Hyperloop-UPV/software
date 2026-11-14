import { useCallback, useMemo } from "react";
import { mapPanes } from "../lib/normal/layout";
import { useStore } from "../store/store";
import type {
  ChartPane,
  DashboardSettings,
  NormalDashboard,
  TimeRange,
} from "../types/normal";

const SAME = 1e-4;

const equal = (a: TimeRange, b: TimeRange) =>
  Math.abs(a.start - b.start) < SAME && Math.abs(a.end - b.end) < SAME;

// Drop a pane's own window so it follows the dashboard again.
const unpin = (pane: ChartPane): ChartPane => {
  if (!pane.timeWindow) return pane;
  const rest = { ...pane };
  delete rest.timeWindow;
  return rest;
};

const releaseAllPanes = (settings: DashboardSettings): DashboardSettings => {
  const tree = mapPanes(settings.layoutState.tree, unpin);
  return tree === settings.layoutState.tree
    ? settings
    : { ...settings, layoutState: { ...settings.layoutState, tree } };
};

/**
 * The single funnel for everything that moves time in a dashboard.
 *
 * Deliberately not routed through `changePane`: that helper always clears
 * `layoutState.preset`, and panning time must not drop the layout preset.
 */
export function useDashboardTimeWindow(dashboard: NormalDashboard) {
  const update = useStore((state) => state.updateNormalDashboardSettings);
  const id = dashboard.id;
  const { range, linkTimeAxis } = dashboard.settings;

  // The hot path while linked: one window for the whole dashboard.
  const setRange = useCallback(
    (next: TimeRange) => {
      update(id, (settings) =>
        equal(settings.range, next) ? settings : { ...settings, range: next },
      );
    },
    [id, update],
  );

  // Toolbar actions: move everything and pull stray plots back in line.
  const setRangeForAll = useCallback(
    (next: TimeRange) => {
      update(id, (settings) => {
        const released = releaseAllPanes(settings);
        return equal(settings.range, next) && released === settings
          ? settings
          : { ...released, range: next };
      });
    },
    [id, update],
  );

  const setPaneWindow = useCallback(
    (paneId: string, next: TimeRange | null) => {
      update(id, (settings) => {
        const tree = mapPanes(settings.layoutState.tree, (pane) => {
          if (pane.id !== paneId) return pane;
          if (!next) return unpin(pane);
          if (pane.timeWindow && equal(pane.timeWindow, next)) return pane;
          return { ...pane, timeWindow: next };
        });
        return tree === settings.layoutState.tree
          ? settings
          : { ...settings, layoutState: { ...settings.layoutState, tree } };
      });
    },
    [id, update],
  );

  const setLinked = useCallback(
    (next: boolean) => {
      update(id, (settings) => {
        if (settings.linkTimeAxis === next) return settings;
        // Re-linking adopts the dashboard window everywhere; keeping the old
        // per-pane positions would only make a later unlink jump.
        const base = next ? releaseAllPanes(settings) : settings;
        return { ...base, linkTimeAxis: next };
      });
    },
    [id, update],
  );

  return useMemo(
    () => ({
      range,
      linkTimeAxis,
      setRange,
      setRangeForAll,
      setPaneWindow,
      setLinked,
    }),
    [range, linkTimeAxis, setRange, setRangeForAll, setPaneWindow, setLinked],
  );
}
