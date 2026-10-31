// Dialog for exporting all currently visible plots to a single PDF report.
// The report itself (chart pages, check page) always includes the same
// fixed elements — these checkboxes only control the optional Index/
// Statistics/Annex sections (src/lib/pdfExport). The stats layout control
// (combined vs. per-sheet) only matters when stats are on. A non-empty title
// additionally prepends a cover page (see addCoverPage in pages.ts).
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SegmentedControl,
  Spinner,
} from "@hyperloop-upv/frontend-kit/components";
import { useState } from "react";
import type { PdfExportOptions, PdfExportResult } from "../../../lib/pdfExport/types";

const STATS_MODE_OPTIONS: { label: string; value: PdfExportOptions["statsMode"] }[] = [
  { label: "All together", value: "combined" },
  { label: "Per sheet", value: "perSheet" },
];

interface PdfExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: PdfExportOptions) => Promise<PdfExportResult>;
  visiblePlotCount: number;
}

export default function PdfExportModal({ open, onClose, onExport, visiblePlotCount }: PdfExportModalProps) {
  const [title, setTitle]               = useState("");
  const [includeToc, setIncludeToc]     = useState(true);
  const [includeStats, setIncludeStats] = useState(true);
  const [statsMode, setStatsMode]       = useState<PdfExportOptions["statsMode"]>("combined");
  const [includeAnnex, setIncludeAnnex] = useState(true);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleClose = () => {
    if (busy) return; // generation is already underway — closing wouldn't stop it, just hide progress
    setError("");
    setNotice("");
    onClose();
  };

  const handleExport = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await onExport({ title, includeToc, includeStats, statsMode, includeAnnex });
      if (result.generated === 0) {
        setError("No plots could be rendered — nothing to export.");
        return;
      }
      if (result.skipped > 0) {
        // Partial success — the PDF was downloaded, but keep the dialog open
        // with a notice instead of silently closing on an incomplete report.
        setNotice(
          `Exported ${result.generated} of ${result.generated + result.skipped} plots — ${result.skipped} could not be rendered.`,
        );
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[26rem]">
        <DialogHeader>
          <DialogTitle>Export PDF Report</DialogTitle>
          <p className="text-muted-foreground text-xs">
            Exports all {visiblePlotCount} currently visible plot{visiblePlotCount !== 1 && "s"}, one chart per page.
          </p>
        </DialogHeader>

        {busy ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner className="text-primary size-8" />
            <p className="text-muted-foreground text-sm">Generating PDF report…</p>
            <p className="text-muted-foreground text-center text-xs">
              Rendering {visiblePlotCount} plot{visiblePlotCount !== 1 && "s"} — this can take a moment.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            {visiblePlotCount === 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                No visible plots — add or unhide a plot first.
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pdf-title" className="text-sm font-normal">Document title (optional)</Label>
              <Input
                id="pdf-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Session Report"
                className="h-8 text-sm"
              />
              <p className="text-muted-foreground text-[11px]">
                Adds a cover page with this title between the Hyperloop UPV and sw logos.
              </p>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={includeToc} onCheckedChange={(v) => setIncludeToc(v === true)} />
              <Label className="font-normal">Include Table of Contents</Label>
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={includeStats} onCheckedChange={(v) => setIncludeStats(v === true)} />
              <Label className="font-normal">Include Statistics page (full data range)</Label>
            </label>
            {includeStats && (
              <div className="ml-6 flex items-center gap-2.5">
                <span className="text-muted-foreground text-xs">Layout</span>
                <SegmentedControl options={STATS_MODE_OPTIONS} value={statsMode} onChange={setStatsMode} />
              </div>
            )}
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={includeAnnex} onCheckedChange={(v) => setIncludeAnnex(v === true)} />
              <Label className="font-normal">Include Series Annex</Label>
            </label>

            {error && (
              <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-xs">{error}</p>
            )}
            {notice && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                {notice} The PDF with the successfully rendered plots was already downloaded.
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={busy}>
            {notice ? "Close" : "Cancel"}
          </Button>
          <Button className="flex-1" onClick={handleExport} disabled={busy || visiblePlotCount === 0}>
            {busy && <Spinner className="mr-1.5 size-3.5" />}
            {busy ? "Generating…" : "Generate PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
