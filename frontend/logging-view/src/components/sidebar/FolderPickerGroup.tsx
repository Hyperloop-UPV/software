// Sidebar group for opening a log session folder.
// Provides two ways to open: clicking the button (hidden <input webkitdirectory>)
// or dragging a folder from the file manager and dropping it onto the zone.
// The drop zone is always visible; it highlights when a drag is active over it.
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@hyperloop-upv/frontend-kit/components";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ExternalLink,
  GitCommit,
  Timer,
  X,
} from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useCallback, useRef, useState } from "react";
import { useStore } from "../../store/store";
import type { DroppedFile } from "../../types/session";
import SessionStatusBadge from "./SessionStatusBadge";
import { sessionStatusStyles } from "./sessionStatusStyles";

// Backend writes dates as "2025-06-15T13-45-22" (dashes in time part).
function formatSessionDate(raw: string): string {
  const fixed = raw.replace(/T(\d{2})-(\d{2})-(\d{2})$/, "T$1:$2:$3");
  const d = new Date(fixed);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
  basePath: string,
): Promise<DroppedFile[]> {
  const results: DroppedFile[] = [];
  const reader = entry.createReader();
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));
  let batch: FileSystemEntry[];
  do {
    batch = await readBatch();
    for (const child of batch) {
      if (child.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (child as FileSystemFileEntry).file(resolve, reject),
        );
        results.push({
          name: file.name,
          webkitRelativePath: `${basePath}/${file.name}`,
          text: () => file.text(),
        });
      } else if (child.isDirectory) {
        const sub = await readDirectoryEntry(
          child as FileSystemDirectoryEntry,
          `${basePath}/${child.name}`,
        );
        results.push(...sub);
      }
    }
  } while (batch.length > 0);
  return results;
}

const FolderPickerGroup = () => {
  const openSession = useStore((s) => s.openSession);
  const clearSession = useStore((s) => s.clearSession);
  const folderName = useStore((s) => s.folderName);
  const settings = useStore((s) => s.settings);
  const availableSeries = useStore((s) => s.availableSeries);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const isLoading = useStore((s) => s.isLoading);
  const isSessionPanelOpen = useStore((s) => s.isSessionPanelOpen);
  const setSessionPanelOpen = useStore((s) => s.setSessionPanelOpen);

  const inputRef = useRef<HTMLInputElement>(null);
  // Counter tracks nested dragenter/dragleave pairs to avoid flicker.
  const dragCounter = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleButtonClick = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      openSession(Array.from(files));
      e.target.value = "";
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items[0]?.kind === "file") {
      dragCounter.current += 1;
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragOver(false);
      const item = e.dataTransfer.items[0];
      if (!item) return;
      const entry = item.webkitGetAsEntry();
      if (!entry?.isDirectory) return;
      const files = await readDirectoryEntry(
        entry as FileSystemDirectoryEntry,
        entry.name,
      );
      openSession(files);
    },
    [openSession],
  );

  return (
    <Collapsible open={isSessionPanelOpen} onOpenChange={setSessionPanelOpen} className="group/session">
    <SidebarGroup>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        {...{ webkitdirectory: "" }}
      />

      <CollapsibleTrigger asChild>
        <SidebarGroupLabel className="cursor-pointer select-none gap-1">
          Session
          {/* Collapsed summary — inline, only visible when collapsed */}
          {folderName && (
            <span className="group-data-[state=open]/session:hidden flex min-w-0 items-center gap-1 truncate text-[10px] opacity-60">
              {sessionStatus && (
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    sessionStatusStyles[sessionStatus.level].dotClass,
                  )}
                />
              )}
              <span className="truncate font-medium">{folderName}</span>
              {settings && (
                <>
                  <span>·</span>
                  <GitCommit className="size-3 shrink-0" />
                  <span className="font-mono">{settings.adj_commit_hash.slice(0, 7)}</span>
                </>
              )}
            </span>
          )}
          <ChevronDown className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/session:rotate-180" />
        </SidebarGroupLabel>
      </CollapsibleTrigger>

      <CollapsibleContent>
      <SidebarGroupContent className="px-2">
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-[6rem] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/20 hover:border-muted-foreground/40",
          )}
        >
          {isLoading ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : folderName ? (
            // Session loaded — show metadata.
            // The × in the top-right corner is a root-level dismiss (clears the whole
            // session), intentionally distinct from the board-level chevron toggles below.
            <div className="relative w-full min-w-0 text-xs">
              {/* Root-level close — higher hierarchy than board collapsibles */}
              <button
                type="button"
                aria-label="Close session"
                onClick={clearSession}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 absolute -right-1 -top-1 rounded p-0.5 transition-colors"
              >
                <X className="size-3.5" />
              </button>

              <div className="text-muted-foreground pr-4">
                <p className="text-foreground truncate font-medium">{folderName}</p>
                {sessionStatus && <SessionStatusBadge status={sessionStatus} className="mt-1" />}
                {settings && (
                  <div className="mt-1 space-y-0.5">
                    <p className="truncate">{formatSessionDate(settings.date)}</p>
                    <p className="flex items-center gap-1">
                      <Timer className="size-3 shrink-0" />
                      <span>{settings.time_unit}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1 opacity-60 hover:opacity-100 hover:underline"
                        onClick={() =>
                          window.open(
                            `https://hyperloop-upv.github.io/ADJ-Archive/storage/commit-${settings.adj_commit_hash}.json`,
                            "_blank",
                          )
                        }
                      >
                        <GitCommit className="size-3 shrink-0" />
                        <span className="truncate font-mono">
                          {settings.adj_commit_hash.slice(0, 7)}
                        </span>
                        <ExternalLink className="size-3 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.electronAPI) {
                            console.warn("electronAPI is not available");
                            return;
                          }
                          window.electronAPI.switchView("adj-view", {
                            commit: settings.adj_commit_hash,
                          });
                        }}
                        className="text-muted-foreground hover:text-primary flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-colors"
                        title="View ADJ"
                      >
                        <BookOpen className="size-3 shrink-0" />
                      </button>
                      {sessionStatus?.adj && !sessionStatus.adj.ok && (
                        <span title={sessionStatus.adj.message ?? undefined}>
                          <AlertTriangle className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {!settings && Object.keys(availableSeries).length > 0 && (
                  <p className="mt-1 truncate">
                    {Object.keys(availableSeries).length} board
                    {Object.keys(availableSeries).length !== 1 && "s"} ·{" "}
                    {Object.values(availableSeries).reduce((n, ids) => n + ids.length, 0)} series
                    (CSV-only)
                  </p>
                )}
                <button
                  onClick={handleButtonClick}
                  className="text-muted-foreground hover:text-foreground mt-2 text-[10px] underline-offset-2 hover:underline"
                >
                  Change folder
                </button>
              </div>
            </div>
          ) : (
            // No session — prompt to open or drop
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                  "size-8 transition-colors",
                  isDragOver ? "text-primary" : "text-muted-foreground/40",
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                />
              </svg>
              <p className="text-muted-foreground text-center text-[11px] leading-snug">
                {isDragOver ? "Release to open" : "Drop folder here"}
              </p>
              <button
                onClick={handleButtonClick}
                className="text-muted-foreground hover:text-foreground text-[10px] underline underline-offset-2"
              >
                or browse…
              </button>
            </>
          )}
        </div>
      </SidebarGroupContent>
      </CollapsibleContent>
    </SidebarGroup>
    </Collapsible>
  );
};

export default FolderPickerGroup;
