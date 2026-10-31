// Appears above the Series checklist once one or more measurements are
// checked, letting the user add them all to an existing plot or spin up a
// new plot containing them — turns the (previously decorative) checkbox
// selection into a real bulk-assign action.
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@hyperloop-upv/frontend-kit/components";
import { Layers, Plus, X } from "@hyperloop-upv/frontend-kit/icons";
import { useMemo, useState } from "react";
import { useAssignSignalsToPlot } from "../simple/hooks/useStudioSignals";
import { useStore } from "../../store/store";

export default function SeriesSelectionBar() {
  const selectedSeries = useStore((s) => s.selectedSeries);
  const clearSelectedSeries = useStore((s) => s.clearSelectedSeries);
  const studioPlots = useStore((s) => s.studioPlots);
  const addStudioPlot = useStore((s) => s.addStudioPlot);
  const assignSignalsToPlot = useAssignSignalsToPlot();
  const [busy, setBusy] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selectedSeries).filter((k) => selectedSeries[k]),
    [selectedSeries],
  );
  const plots = useMemo(() => Array.from(studioPlots.values()), [studioPlots]);

  if (selectedIds.length === 0) return null;

  const runAndClear = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      clearSelectedSeries();
    } finally {
      setBusy(false);
    }
  };

  const handleNewPlot = () =>
    runAndClear(async () => {
      const plotId = addStudioPlot();
      await assignSignalsToPlot(plotId, selectedIds);
    });

  const handleAddToPlot = (plotId: string) =>
    runAndClear(() => assignSignalsToPlot(plotId, selectedIds));

  return (
    <div className="bg-sidebar-accent/30 flex flex-col gap-2 border-b px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{selectedIds.length} selected</span>
        <button
          type="button"
          onClick={() => clearSelectedSeries()}
          disabled={busy}
          className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[10px] disabled:opacity-50"
        >
          <X className="size-3" /> Clear
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={handleNewPlot} disabled={busy}>
          <Plus className="mr-1 size-3.5" />
          {busy ? "Adding…" : "New Plot"}
        </Button>
        <Select disabled={busy || plots.length === 0} value="" onValueChange={handleAddToPlot}>
          <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
            <Layers className="mr-1 size-3.5" />
            <SelectValue placeholder={plots.length === 0 ? "No plots yet" : busy ? "Adding…" : "Add to Plot"} />
          </SelectTrigger>
          <SelectContent>
            {plots.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
