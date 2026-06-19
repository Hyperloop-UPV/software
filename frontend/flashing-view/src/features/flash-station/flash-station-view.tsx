import { useEffect, useRef, useState } from "react";
import { FileCode2, Loader2, SunMoon, Upload } from "@workspace/ui/icons";
import { Badge, Button, Textarea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components";
import logo from "../../assets/logo.svg";
import { SectionCard } from "./components/section-card";
import { BoardCard } from "./components/board-card";
import type { Board } from "./types";

const BLCU_URL = "http://localhost:8069/api";
const POLL_INTERVAL_MS = 300;
const MAX_LOG_LINES = 20;

interface FlashStationViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function FlashStationView({ isDark, onToggleTheme }: FlashStationViewProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll /boards every 300ms. Deselects the current board if it disappears.
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${BLCU_URL}/boards`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Board[] = await res.json();
        setBoards(data);
        setSelectedBoard((prev) =>
          data.some((b) => b.name === prev) ? prev : null,
        );
      } catch {
        setBoards([]);
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  function appendLog(message: string) {
    const timestamp = new Date().toLocaleTimeString("es-ES");
    setLog((prev) =>
      [...prev, `[${timestamp}] ${message}`].slice(-MAX_LOG_LINES),
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
      );
    } finally {
      setIsFlashing(false);
    }
  }

  const connectedCount = boards.length;
  const canFlash = !!file && !!selectedBoard && !isFlashing;

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
        <div className="bg-primary/25 h-[3px] flex-1 rounded-full" />
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
            <Button className="w-full" onClick={selectFile}>
              <FileCode2 className="size-4" />
              Choose File
            </Button>
            <div className="border-border/80 bg-secondary/45 rounded-lg border px-3">
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

          <SectionCard title="Log">
            <Textarea
              readOnly
              value={log.join("\n")}
              className="border-border/80 bg-secondary/45 text-foreground min-h-40 resize-none font-mono text-xs"
            />
          </SectionCard>
        </div>

        <SectionCard
          title="Boards"
          action={
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary rounded-full"
            >
              {connectedCount} connected
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
      </section>
    </main>
  );
}
