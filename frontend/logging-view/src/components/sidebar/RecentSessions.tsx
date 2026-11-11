// The last session folders opened through the desktop app, offered on the
// empty state. Hidden in a plain browser, where a path cannot be reopened.
import { Button } from "@hyperloopupv/frontend-kit/components";
import { Folder, X } from "@hyperloopupv/frontend-kit/icons";
import { useStore } from "../../store/store";
import { useSessionFolder } from "../../hooks/useSessionFolder";

const MINUTE = 60_000;

function relativeTime(at: number): string {
  const elapsed = Date.now() - at;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < 60 * MINUTE) return `${Math.round(elapsed / MINUTE)} min ago`;
  if (elapsed < 48 * 60 * MINUTE)
    return `${Math.round(elapsed / (60 * MINUTE))} h ago`;
  return new Date(at).toLocaleDateString();
}

export default function RecentSessions({ limit = 5 }: { limit?: number }) {
  const recentSessions = useStore((state) => state.recentSessions);
  const forgetRecentSession = useStore((state) => state.forgetRecentSession);
  const { canOpenPaths, openPath, busyPath, failure } = useSessionFolder();

  if (!canOpenPaths || recentSessions.length === 0) return null;

  return (
    <section aria-label="Recent sessions" className="mt-6 text-left">
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold">
        Recent sessions
      </h3>
      <ul className="space-y-1">
        {recentSessions.slice(0, limit).map((session) => (
          <li key={session.path}>
            <div className="group hover:bg-muted/60 flex items-center gap-2 rounded-md px-1">
              <button
                type="button"
                disabled={!!busyPath}
                aria-label={`Open ${session.folderName}`}
                title={session.path}
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left disabled:opacity-50"
                onClick={() => void openPath(session.path)}
              >
                <Folder className="text-muted-foreground size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {session.folderName}
                  </span>
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {session.series
                      ? `${session.boards} boards · ${session.series} series · `
                      : ""}
                    {session.path}
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {busyPath === session.path
                    ? "Opening…"
                    : relativeTime(session.openedAt)}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Forget ${session.folderName}`}
                title="Remove from recent sessions"
                className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => forgetRecentSession(session.path)}
              >
                <X className="size-3" />
              </Button>
            </div>
            {failure?.path === session.path && (
              <p className="px-1 pb-1 text-[10px] text-amber-600 dark:text-amber-400">
                {failure.message} — the folder may have moved; remove it from
                the list.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
