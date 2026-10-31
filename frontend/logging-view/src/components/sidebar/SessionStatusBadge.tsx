// Persistent green/yellow/red status pill shown in the sidebar for the currently
// open session (logger settings / CSV / ADJ availability). See SessionStatus in
// types/session.ts for the cascade this reflects.
import { Badge } from "@hyperloop-upv/frontend-kit/components";
import { AlertTriangle } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import type { SessionStatus } from "../../types/session";
import { adjWarningClass, sessionStatusStyles } from "./sessionStatusStyles";

interface SessionStatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

const SessionStatusBadge = ({ status, className }: SessionStatusBadgeProps) => {
  const { icon: Icon, badgeClass } = sessionStatusStyles[status.level];

  return (
    <div className={cn("space-y-1", className)}>
      <Badge variant="outline" className={cn(badgeClass, "max-w-full")}>
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{status.message}</span>
      </Badge>
      {status.adj && !status.adj.ok && (
        <p className={cn("flex items-start gap-1 text-[10px] leading-snug", adjWarningClass)}>
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <span>{status.adj.message}</span>
        </p>
      )}
    </div>
  );
};

export default SessionStatusBadge;
