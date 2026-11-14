// Bulk actions for the checked measurements. In Normal mode the selection is
// staged inside the active dashboard; in Simple mode it targets Plot Studio.
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hyperloopupv/frontend-kit/components";
import { Layers, Plus, X } from "@hyperloopupv/frontend-kit/icons";
import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useSeriesSelection } from "../../hooks/useSeriesSelection";
import { getPanes } from "../../lib/normal/layout";
import { useStore } from "../../store/store";
import { useAssignSignalsToPlot } from "../simple/hooks/useStudioSignals";

export default function SeriesSelectionBar() {
  const isNormal = !useLocation().pathname.startsWith("/simple");
  const { selectedSeries, clearSelectedSeries, isSelectionLocked } =
    useSeriesSelection();
  const studioPlots = useStore((state) => state.studioPlots);
  const addStudioPlot = useStore((state) => state.addStudioPlot);
  const addNormalPlot = useStore((state) => state.addNormalPlot);
  const assignNormalSignalsToPlot = useStore(
    (state) => state.assignNormalSignalsToPlot,
  );
  const dashboard = useStore((state) =>
    state.normalDashboards.find(
      (item) => item.id === state.activeNormalDashboardId,
    ),
  );
  const assignStudioSignals = useAssignSignalsToPlot();
  const [busy, setBusy] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selectedSeries).filter((key) => selectedSeries[key]),
    [selectedSeries],
  );
  const plots = useMemo(
    () =>
      isNormal && dashboard
        ? getPanes(dashboard.settings.layoutState.tree).map((plot, index) => ({
            id: plot.id,
            name: plot.title || `Plot ${index + 1}`,
          }))
        : Array.from(studioPlots.values()).map((plot) => ({
            id: plot.id,
            name: plot.name,
          })),
    [dashboard, isNormal, studioPlots],
  );

  if (selectedIds.length === 0) return null;

  const handleNewPlot = async () => {
    if (isNormal) {
      addNormalPlot(selectedIds);
      clearSelectedSeries();
      return;
    }
    setBusy(true);
    try {
      const plotId = addStudioPlot();
      await assignStudioSignals(plotId, selectedIds);
      clearSelectedSeries();
    } finally {
      setBusy(false);
    }
  };

  const handleAddToPlot = async (plotId: string) => {
    if (isNormal) {
      assignNormalSignalsToPlot(plotId, selectedIds);
      clearSelectedSeries();
      return;
    }
    setBusy(true);
    try {
      await assignStudioSignals(plotId, selectedIds);
      clearSelectedSeries();
    } finally {
      setBusy(false);
    }
  };

  const atPlotLimit = isNormal && plots.length >= 8;
  const disabled = busy || isSelectionLocked;

  return (
    <div className="bg-sidebar-accent/30 flex flex-col gap-2 border-b px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium">
          {selectedIds.length} measurement
          {selectedIds.length === 1 ? "" : "s"} selected
        </span>
        <button
          type="button"
          onClick={clearSelectedSeries}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[10px] disabled:opacity-50"
        >
          <X className="size-3" /> Clear
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs"
          onClick={() => void handleNewPlot()}
          disabled={disabled || atPlotLimit}
        >
          <Plus className="mr-1 size-3.5" />
          {busy ? "Adding…" : "New plot"}
        </Button>
        <Select
          disabled={disabled || plots.length === 0}
          value=""
          onValueChange={(plotId) => void handleAddToPlot(plotId)}
        >
          <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
            <Layers className="mr-1 size-3.5" />
            <SelectValue
              placeholder={
                plots.length === 0
                  ? "No plots yet"
                  : busy
                    ? "Adding…"
                    : "Add to plot"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {plots.map((plot) => (
              <SelectItem key={plot.id} value={plot.id}>
                {plot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
