import { useLocation } from "react-router";
import { useStore } from "../store/store";

// Sidebar checkboxes and the header always act on the visible workspace.
// Simple mode retains its separate bulk selection for Plot Studio.
export function useSeriesSelection() {
  const isNormal = !useLocation().pathname.startsWith("/simple");
  const selectedSeries = useStore((state) =>
    isNormal
      ? state.normalDashboards.find(
          (dashboard) => dashboard.id === state.activeNormalDashboardId,
        )!.selectedSeries
      : state.selectedSeries,
  );
  const toggleSeries = useStore((state) =>
    isNormal ? state.toggleNormalSeries : state.toggleSeries,
  );
  const clearSelectedSeries = useStore((state) =>
    isNormal ? state.clearNormalSeries : state.clearSelectedSeries,
  );
  const isSelectionLocked = useStore(
    (state) =>
      isNormal &&
      !!state.normalDashboards.find(
        (dashboard) => dashboard.id === state.activeNormalDashboardId,
      )?.locked,
  );
  return {
    selectedSeries,
    toggleSeries,
    clearSelectedSeries,
    isSelectionLocked,
  };
}
