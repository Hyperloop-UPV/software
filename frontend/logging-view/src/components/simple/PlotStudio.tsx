// Simple mode — Plot Studio. All session series are available by default;
// plots and composed series are managed in the right studio panel, laid out
// VS Code-style: a fixed activity bar with one open section at a time, and
// only the plots area scrolls.
import { Button, Separator } from "@hyperloop-upv/frontend-kit/components";
import { FileDown, PanelRight, Plus, X } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/store";
import PdfExportModal from "./modals/PdfExportModal";
import PlotsArea, { type PlotsAreaHandle } from "./plots/PlotsArea";
import StudioSidebar from "./sidebar/StudioSidebar";
import { STUDIO_SECTIONS } from "./sidebar/studioSections";

export default function PlotStudio() {
  // Open section id, null = panel closed. Plots is open by default.
  const [activeSection, setActiveSection] = useState<string | null>(STUDIO_SECTIONS[0].id);
  // Remembered so the toolbar toggle reopens the last-used section
  const lastSection = useRef(STUDIO_SECTIONS[0].id);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const plotsAreaRef = useRef<PlotsAreaHandle>(null);

  const seriesCount = useStore((s) =>
    Object.values(s.availableSeries).reduce((n, ids) => n + ids.length, 0),
  );
  const plotCount = useStore((s) => s.studioPlots.size);
  const visiblePlotCount = useStore((s) =>
    Array.from(s.studioPlots.values()).filter((p) => !p.hidden).length,
  );
  const addStudioPlot = useStore((s) => s.addStudioPlot);
  const signalLoadWarning = useStore((s) => s.signalLoadWarning);
  const setSignalLoadWarning = useStore((s) => s.setSignalLoadWarning);

  useEffect(() => {
    if (!signalLoadWarning) return;
    const timer = setTimeout(() => setSignalLoadWarning(null), 6000);
    return () => clearTimeout(timer);
  }, [signalLoadWarning, setSignalLoadWarning]);

  // VS Code semantics: clicking the active icon closes the panel
  const selectSection = (id: string) => {
    lastSection.current = id;
    setActiveSection((prev) => (prev === id ? null : id));
  };

  const togglePanel = () =>
    setActiveSection((prev) => (prev ? null : lastSection.current));

  return (
    <div className="bg-background text-foreground flex h-full overflow-hidden">
      {/* Main content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar — fixed above the scrolling plots area */}
        <div className="bg-background flex h-12 shrink-0 items-center gap-3 border-b px-4">
          <span className="text-muted-foreground text-xs tabular-nums">
            {seriesCount} series available
            <span className="text-muted-foreground/50 mx-1.5">·</span>
            {plotCount} plot{plotCount !== 1 && "s"}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addStudioPlot}>
              <Plus className="mr-1 size-3.5" />
              Add Plot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPdfDialogOpen(true)}
              disabled={visiblePlotCount === 0}
            >
              <FileDown className="mr-1 size-3.5" />
              Export PDF
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePanel}
              aria-label="Toggle studio panel"
              title="Toggle studio panel"
            >
              <PanelRight className={cn("size-4 transition-colors", activeSection && "text-primary")} />
            </Button>
          </div>
        </div>

        {signalLoadWarning && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400">
            <span className="flex-1">{signalLoadWarning}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setSignalLoadWarning(null)}
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Scrolling plots area */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlotsArea ref={plotsAreaRef} />
        </div>
      </div>

      <StudioSidebar activeSection={activeSection} onSelect={selectSection} />

      <PdfExportModal
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        onExport={(options) => plotsAreaRef.current!.exportToPdf(options)}
        visiblePlotCount={visiblePlotCount}
      />
    </div>
  );
}
