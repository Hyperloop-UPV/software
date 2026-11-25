import Plotly from "plotly.js-dist";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { buildAndDownloadPdf } from "../../../lib/pdfExport/buildPdf";
import { collectAnnexRows, collectSessionInfo, collectStatsRows } from "../../../lib/pdfExport/collectData";
import { PDF_CHART_IMAGE_OPTS } from "../../../lib/pdfExport/assets";
import type { ChartExport, PdfExportOptions, PdfExportResult } from "../../../lib/pdfExport/types";
import { useStore } from "../../../store/store";
import PlotWrapper, { type PlotExportHandle } from "./PlotWrapper";

function EmptyState() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 px-8 py-12">
      {/* Waveform illustration */}
      <div className="flex items-end justify-center gap-1" style={{ height: 56 }}>
        {[0.3, 0.6, 1, 0.8, 0.45, 0.9, 0.55, 0.7, 0.35, 0.65, 1, 0.5].map((h, i) => (
          <div
            key={i}
            className="bg-primary/40 w-2 rounded-t"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm text-center">
        <h2 className="text-foreground mb-2 text-xl font-semibold">No plots yet</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          All session series are ready to plot — use the{" "}
          <span className="text-foreground font-medium">right panel</span> to add a plot and assign signals.
        </p>
      </div>

      {/* Steps */}
      <div className="border-border bg-card/60 flex w-full max-w-md items-start justify-around gap-2 rounded-xl border px-6 py-5 shadow-sm">
        {[
          { step: "1", label: "Add plot",      desc: "Toolbar or Plots panel" },
          { step: "2", label: "Assign series", desc: "Any series, grouped by board" },
          { step: "3", label: "Compose",       desc: "Derive new series with ∑ or 𝑓" },
        ].map(({ step, label, desc }, idx) => (
          <div key={step} className="flex flex-col items-center gap-2 text-center">
            <div className="bg-primary/15 text-primary flex size-8 items-center justify-center rounded-full text-sm font-bold">
              {step}
            </div>
            <span className="text-foreground text-xs font-semibold">{label}</span>
            <span className="text-muted-foreground text-[10px] leading-tight">{desc}</span>
            {idx < 2 && (
              <div className="text-muted-foreground/40 hidden text-lg sm:block">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PlotsAreaHandle {
  exportToPdf: (options: PdfExportOptions) => Promise<PdfExportResult>;
}

const PlotsArea = forwardRef<PlotsAreaHandle>((_props, ref) => {
  const studioPlots = useStore((s) => s.studioPlots);
  const plots = Array.from(studioPlots.values());
  const visiblePlots = plots.filter((plot) => !plot.hidden);

  const plotHandles = useRef(new Map<string, PlotExportHandle>());
  const setPlotHandleRef = (id: string) => (el: PlotExportHandle | null) => {
    if (el) plotHandles.current.set(id, el);
    else plotHandles.current.delete(id);
  };

  useImperativeHandle(ref, () => ({
    exportToPdf: async (options) => {
      const charts: ChartExport[] = [];
      let skipped = 0;

      // Sequential, not Promise.all — Plotly.toImage does a heavy synchronous
      // render internally per call; running many in parallel would spike
      // peak memory/CPU for sessions with several plots.
      for (const plot of visiblePlots) {
        const handle = plotHandles.current.get(plot.id);
        if (!handle || !handle.hasTraces) { skipped++; continue; }
        const figure = handle.getExportFigure(PDF_CHART_IMAGE_OPTS.height);
        if (!figure) { skipped++; continue; }
        try {
          const imageDataUrl = await Plotly.toImage(figure, PDF_CHART_IMAGE_OPTS);
          charts.push({
            plotId: handle.plotId,
            title: handle.title,
            imageDataUrl,
            pixelWidth: PDF_CHART_IMAGE_OPTS.width,
            pixelHeight: PDF_CHART_IMAGE_OPTS.height,
          });
        } catch (err) {
          console.warn(`PDF export: failed to render plot "${handle.title}"`, err);
          skipped++;
        }
      }

      const state = useStore.getState();
      const statsRows = options.includeStats ? collectStatsRows(visiblePlots, state, state.adjData) : [];
      const annexRows = options.includeAnnex ? collectAnnexRows(visiblePlots, state, state.adjData) : [];
      const sessionInfo = collectSessionInfo(state);

      await buildAndDownloadPdf({ charts, options, statsRows, annexRows, sessionInfo });

      return { generated: charts.length, skipped };
    },
  }), [visiblePlots]);

  if (plots.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-5 p-4">
      {visiblePlots.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          All plots are hidden — unhide one from the right panel to see it here.
        </p>
      ) : (
        visiblePlots.map((plot) => (
          <PlotWrapper key={plot.id} ref={setPlotHandleRef(plot.id)} plot={plot} />
        ))
      )}
    </div>
  );
});

PlotsArea.displayName = "PlotsArea";
export default PlotsArea;
