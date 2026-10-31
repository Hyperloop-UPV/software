// Shared green/yellow/red styling for SessionStatus, used by both the persistent
// sidebar badge and the transient toast so the two stay visually consistent.
import { AlertTriangle, CheckCircle2, XCircle } from "@hyperloop-upv/frontend-kit/icons";
import type { SessionStatusLevel } from "../../types/session";

export const sessionStatusStyles: Record<
  SessionStatusLevel,
  { icon: typeof CheckCircle2; badgeClass: string; dotClass: string }
> = {
  ok: {
    icon: CheckCircle2,
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  degraded: {
    icon: AlertTriangle,
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  error: {
    icon: XCircle,
    badgeClass: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
    dotClass: "bg-red-500",
  },
};

// Standalone amber styling for the secondary ADJ-failure line, independent of the
// overall level (an ADJ failure never inherits the "error" red — it's always a warning).
export const adjWarningClass = "text-amber-600 dark:text-amber-400";
