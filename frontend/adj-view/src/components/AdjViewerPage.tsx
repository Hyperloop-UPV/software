// Standalone ADJ Viewer page: fetch an ADJ archive by commit hash and browse it.
// No session/store dependency — this app only ever knows what the user types in.
import {
  Badge,
  Button,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components";
import { AlertTriangle, GitCommit, Loader2, RefreshCw, SunMoon } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import logo from "@workspace/ui/outreach/main/logo_icon.svg";
import { useCallback, useEffect, useState } from "react";
import { config } from "../../config";
import { parseAdj, summarizeAdj, type ParsedAdj } from "../adj";
import { AdjViewer } from "../adj/AdjViewer";
import { useBranches } from "../hooks/useBranches";
import { UnsupportedAdjNotice } from "./UnsupportedAdjNotice";

const ADJ_ARCHIVE_URL = (hash: string) =>
  `https://hyperloop-upv.github.io/ADJ-Archive/storage/commit-${hash}.json`;

async function fetchAdjArchive(hash: string): Promise<unknown> {
  const response = await fetch(ADJ_ARCHIVE_URL(hash));
  if (!response.ok) throw new Error(`ADJ fetch failed: ${response.status}`);
  return response.json();
}

async function resolveBranchToCommit(branch: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${config.ADJ_GITHUB_REPO}/branches/${encodeURIComponent(branch)}`,
  );
  if (!response.ok) throw new Error(`Branch lookup failed: ${response.status}`);
  const data = await response.json();
  return data.commit.sha as string;
}

// logo_icon.svg draws the mark in the middle ~49% of its 900×900 viewBox (a
// 340×439 box). Scale the image up inside a clipped square so the mark itself,
// not the empty canvas, is `size` px tall.
const LOGO_SCALE = 900 / 440;

function TeamLogo({ size, alt = "Hyperloop UPV", className }: { size: number; alt?: string; className?: string }) {
  return (
    <span
      className={cn("relative shrink-0 overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={logo}
        alt={alt}
        className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 dark:invert"
        style={{ width: size * LOGO_SCALE, height: size * LOGO_SCALE }}
      />
    </span>
  );
}

interface AdjViewerPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function AdjViewerPage({ isDark, onToggleTheme }: AdjViewerPageProps) {
  const [hashInput, setHashInput] = useState("");
  const [commitHash, setCommitHash] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedAdj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { branches, isLoading: branchesLoading, error: branchesError, refetch: refetchBranches } = useBranches(true);
  const [branchInput, setBranchInput] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [resolvingBranch, setResolvingBranch] = useState(false);

  const adj = parsed?.supported ? parsed.adj : null;
  const version = parsed ? (parsed.supported ? parsed.adj.version : parsed.version) : null;
  const summary = adj ? summarizeAdj(adj) : null;

  const load = useCallback(async (hash: string) => {
    if (!hash) return;
    try {
      setLoading(true);
      setError(null);
      setParsed(parseAdj(await fetchAdjArchive(hash)));
      setCommitHash(hash);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoad = () => load(hashInput.trim());

  const handleBranchSelect = async (branch: string) => {
    if (!branch) return;
    try {
      setResolvingBranch(true);
      setError(null);
      const sha = await resolveBranchToCommit(branch);
      await load(sha);
    } catch (err) {
      setError(String(err));
    } finally {
      setResolvingBranch(false);
    }
  };

  // If launched from logging-view's "View ADJ" shortcut, the main process
  // passes the session's commit hash through as a query param — load it
  // immediately instead of waiting for the user to type it in.
  useEffect(() => {
    const commit = new URLSearchParams(window.location.search).get("commit");
    if (commit) {
      setHashInput(commit);
      load(commit);
    }
  }, [load]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      {/* Below lg the theme toggle sits beside the title and the load controls
          take their own full-width row; from lg it's one row, toggle last. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="order-1 flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 lg:flex-none">
          <TeamLogo size={32} />
          <h1 className="text-foreground text-xl font-bold">ADJ Viewer</h1>
          {commitHash && (
            <span className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
              <GitCommit className="size-3" />
              {commitHash.slice(0, 7)}
            </span>
          )}
          {parsed && (
            <Badge
              variant="outline"
              title={
                parsed.supported
                  ? `ADJ format version v${version} (archives without a "version" field are v2)`
                  : `ADJ v${version} is not supported by this viewer`
              }
              className={cn(
                "font-mono text-[10px]",
                parsed.supported
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
              )}
            >
              {!parsed.supported && <AlertTriangle />}
              ADJ v{version}
            </Badge>
          )}
          {summary && (
            <div className="text-muted-foreground flex flex-wrap gap-x-3 text-[11px]">
              <span><span className="text-foreground font-semibold">{summary.boards}</span> boards</span>
              <span><span className="text-foreground font-semibold">{summary.measurements}</span> measurements</span>
              <span><span className="text-foreground font-semibold">{summary.packets}</span> packets</span>
            </div>
          )}
        </div>

        <div className="order-3 flex w-full flex-wrap items-center gap-2 lg:order-2 lg:ml-auto lg:w-auto lg:flex-nowrap">
          <div className="flex min-w-0 flex-1 basis-[12rem] items-center gap-1 lg:flex-none">
            <Combobox
              items={branches}
              value={selectedBranch}
              onValueChange={(v) => {
                setSelectedBranch(v);
                setBranchInput(v ?? "");
                if (v) handleBranchSelect(v);
              }}
            >
              <ComboboxInput
                placeholder={branchesLoading ? "Loading branches…" : "Branch…"}
                value={branchInput}
                onChange={(e) => {
                  setBranchInput(e.target.value);
                  setSelectedBranch(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleBranchSelect(branchInput.trim());
                }}
                className="h-8 w-full text-xs lg:w-[10rem]"
              />
              <ComboboxContent>
                <ComboboxEmpty>No branches found</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetchBranches}
              disabled={branchesLoading}
              title="Refetch branches"
              className={`size-8 ${branchesError ? "text-destructive hover:text-destructive" : ""}`}
            >
              {resolvingBranch ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className={`size-3.5 ${branchesLoading ? "animate-spin" : ""}`} />
              )}
            </Button>
          </div>

          <span className="text-muted-foreground hidden text-[10px] sm:inline">or</span>

          <div className="flex min-w-0 flex-[2] basis-[14rem] items-center gap-2 lg:flex-none">
            <Input
              placeholder="ADJ commit hash…"
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              className="h-8 min-w-0 flex-1 font-mono text-xs lg:w-[16rem] lg:flex-none"
            />
            <Button size="sm" onClick={handleLoad} disabled={loading || !hashInput.trim()}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Load"}
            </Button>
          </div>
        </div>

        <div className="order-2 lg:order-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
                  <SunMoon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isDark ? "Switch to light mode" : "Switch to dark mode"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {error && (
        <Badge variant="destructive" className="w-fit">
          {error}
        </Badge>
      )}

      <div className="min-h-0 flex-1">
        {adj ? (
          <AdjViewer adj={adj} />
        ) : parsed && !parsed.supported ? (
          <UnsupportedAdjNotice version={parsed.version} />
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
            <TeamLogo size={56} alt="" className="opacity-15" />
            {loading ? "Loading archive…" : "Enter an ADJ commit hash to view its data."}
          </div>
        )}
      </div>
    </div>
  );
}
