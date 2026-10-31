// Transient confirmation toast shown when a new plot is added to Plot Studio
// (issue: adding a plot gave no on-screen feedback). Mirrors SessionStatusToast's
// auto-dismiss + manual-dismiss pattern, but anchored bottom-right so it never
// overlaps that top-right session toast.
import { CheckCircle2, X } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useEffect } from "react";
import { useStore } from "../store/store";
import { sessionStatusStyles } from "./sidebar/sessionStatusStyles";

const PlotAddedToast = () => {
  const plotName = useStore((s) => s.plotAddedToast);
  const setPlotAddedToast = useStore((s) => s.setPlotAddedToast);

  useEffect(() => {
    if (!plotName) return;
    const timer = setTimeout(() => setPlotAddedToast(null), 3000);
    return () => clearTimeout(timer);
  }, [plotName, setPlotAddedToast]);

  if (!plotName) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40 w-72 rounded-lg border p-3 text-xs shadow-lg",
        sessionStatusStyles.ok.badgeClass,
      )}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 shrink-0" />
        <span className="flex-1">
          <span className="font-medium">{plotName}</span> added
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setPlotAddedToast(null)}
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

export default PlotAddedToast;
