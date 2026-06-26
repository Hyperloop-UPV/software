import { Badge, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components";
import { FileCode2, Loader2, SunMoon, Upload } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import logo from "../../assets/logo.svg";
import { BoardCard } from "./components/board-card";
import { SectionCard } from "./components/section-card";
import type { Board, BoardsResponse, GeneralState, OperationalState } from "./types";

const BLCU_URL = import.meta.env.VITE_BLCU_URL ?? "http://localhost:8069/api";
const POLL_INTERVAL_MS = 10000;
const MAX_LOG_LINES = 20;

const STATE_STYLES: Record<GeneralState, string> = {
  Connecting: "border-yellow-500/40 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  Operational: "border-green-500/40 bg-green-500/15 text-green-600 dark:text-green-400",
  Fault: "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400",
};

const OPERATIONAL_STYLES: Record<OperationalState, string> = {
  Idle: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
  Flashing: "border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

type LogEntry = { message: string; isError: boolean };

interface FlashStationViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function FlashStationView({ isDark, onToggleTheme }: FlashStationViewProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [generalState, setGeneralState] = useState<GeneralState>("Connecting");
  const [operationalState, setOperationalState] = useState<OperationalState>("Idle");
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${BLCU_URL}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: BoardsResponse = await res.json();

        const parsed: Board[] = Object.entries(data.boards).map(([name, accessible]) => ({
          name,
          accessible,
        }));

        setBoards(parsed);
        setGeneralState(data.general_state_machine);
        setOperationalState(data.operational_state_machine as OperationalState);
        setSelectedBoard((prev) =>
          parsed.some((b) => b.name === prev) ? prev : null,
        );
      } catch {
        setBoards([]);
        setGeneralState("Connecting");
        setOperationalState("Idle");
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function appendLog(message: string, isError = false) {
    const timestamp = new Date().toLocaleTimeString("es-ES");
    setLog((prev) =>
      [...prev, { message: `[${timestamp}] ${message}`, isError }].slice(-MAX_LOG_LINES),
    );
  }

  async function selectFile() {
    if (window.electronAPI) {
      const path = await window.electronAPI.blcuSelectFile?.();
      if (!path) return;
      const name = path.split(/[/\\]/).pop() ?? path;
      setFilePath(path);
      setFileName(name);
      const buffer = await window.electronAPI.blcuReadFile?.(path);
      if (!buffer) return;
      setFile(new File([buffer], name, { type: "application/octet-stream" }));
    } else {
      fileInputRef.current?.click();
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFileName(picked.name);
    setFilePath(picked.name);
    setFile(picked);
  }

  async function flash() {
    if (!filePath || !selectedBoard || !file) return;
    const board = boards.find((b) => b.name === selectedBoard);
    if (!board) return;

    setIsFlashing(true);
    appendLog(`Flash started → ${board.name}`);

    const form = new FormData();
    form.append("file", file);
    form.append("board", board.name);

    try {
      const res = await fetch(`${BLCU_URL}/flash`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(await res.text());
      appendLog(`Flash successful → ${board.name}`);
    } catch (err) {
      appendLog(
        `Flash failed → ${err instanceof Error ? err.message : "Unknown error"}`,
        true,
      );
    } finally {
      setIsFlashing(false);
    }
  }

  const canFlash = !!file && !!selectedBoard && !isFlashing && operationalState !== "Flashing";

  return (
    <main className="min-h-full w-full p-4">
      <header className="mb-4 flex items-center gap-4">
        <div className="flex shrink-0 items-center gap-3">
          <img src={logo} alt="Hyperloop UPV" className="size-10 dark:invert" />
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Flash Station
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose a firmware file, select a board, and flash.
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className={cn("rounded-full shrink-0", STATE_STYLES[generalState])}
        >
          {generalState}
        </Badge>

        <div className="bg-primary/25 h-[3px] flex-1 rounded-full" />

        <Badge
          variant="outline"
          className={cn("rounded-full shrink-0", OPERATIONAL_STYLES[operationalState])}
        >
          {operationalState}
        </Badge>

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
      </header>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Firmware">
            <input
              ref={fileInputRef}
              type="file"
              accept=".bin,.hex,.elf"
              className="hidden"
              onChange={onFileInputChange}
            />
            <p className="text-muted-foreground text-xs">Accepted formats: .bin, .hex, .elf</p>
            <Button className="w-full" onClick={selectFile}>
              <FileCode2 className="size-4" />
              Choose File
            </Button>
            <div className="border-border/80 bg-secondary/45 rounded-lg border px-3 py-2">
              <div className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
                Selected file
              </div>
              <div className="text-foreground mt-1 truncate font-mono text-sm">
                {fileName || "No file selected"}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Flash">
            <Button className="w-full" onClick={flash} disabled={!canFlash}>
              {isFlashing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {isFlashing ? "Flashing..." : "Flash"}
            </Button>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="Boards"
            action={
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary rounded-full"
              >
                {boards.length} boards
              </Badge>
            }
          >
            {boards.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No boards found. Waiting for backend…
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {boards.map((board) => (
                  <BoardCard
                    key={board.name}
                    board={board}
                    selected={selectedBoard === board.name}
                    onSelect={() => setSelectedBoard(board.name)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Log">
            <div className="border-border/80 bg-secondary/45 rounded-lg border p-3 min-h-40 max-h-60 overflow-y-auto font-mono text-xs space-y-0.5">
              {log.length === 0 ? (
                <span className="text-muted-foreground">No log entries yet.</span>
              ) : (
                log.map((entry, i) => (
                  <div
                    key={i}
                    className={entry.isError ? "text-red-500 dark:text-red-400" : "text-foreground"}
                  >
                    {entry.message}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </SectionCard>
        </div>
      </section>
    </main>
  );
}
