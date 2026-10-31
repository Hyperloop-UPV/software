// Transient green/yellow/red toast shown once when a session finishes opening.
// Floats above page content so it's visible regardless of which route the user is
// on (a session can be opened from the sidebar on any page). Mirrors the auto-dismiss
// + manual-dismiss pattern used by the signalLoadWarning banner in PlotStudio.tsx.
// Bottom-right, same corner as PlotAddedToast, so every transient notification
// in the app reads as one consistent toast stack.
import { AlertTriangle, X } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useEffect } from "react";
import { useStore } from "../store/store";
import { adjWarningClass, sessionStatusStyles } from "./sidebar/sessionStatusStyles";

const SessionStatusToast = () => {
  const status = useStore((s) => s.sessionStatusToast);
  const setSessionStatusToast = useStore((s) => s.setSessionStatusToast);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setSessionStatusToast(null), 6000);
    return () => clearTimeout(timer);
  }, [status, setSessionStatusToast]);

  if (!status) return null;

  const { icon: Icon, badgeClass } = sessionStatusStyles[status.level];

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40 w-80 rounded-lg border p-3 text-xs shadow-lg",
        badgeClass,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <span className="flex-1">{status.message}</span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setSessionStatusToast(null)}
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {status.adj && !status.adj.ok && (
        <p className={cn("mt-1.5 flex items-start gap-1 pl-6", adjWarningClass)}>
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <span>{status.adj.message}</span>
        </p>
      )}
    </div>
  );
};

export default SessionStatusToast;
