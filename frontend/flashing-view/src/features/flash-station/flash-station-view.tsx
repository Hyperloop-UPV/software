import { useEffect, useState } from "react";
import { FileCode2, Loader2, Upload } from "@workspace/ui/icons";
import { Badge, Button, Textarea } from "@workspace/ui/components";
import logo from "../../assets/logo.svg";
import { SectionCard } from "./components/section-card";
import { BoardCard } from "./components/board-card";
import type { Board } from "./types";

const BLCU_URL = "http://localhost:8000";
const POLL_INTERVAL_MS = 300;
const MAX_LOG_LINES = 20;

export function FlashStationView() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);

  // Poll /boards every 300ms. Deselects the current board if it disappears.
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${BLCU_URL}/boards`);
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
    const timestamp = new Date().toLocaleTimeString("en-GB");
    setLog((prev) =>
      [...prev, `[${timestamp}] ${message}`].slice(-MAX_LOG_LINES),
    );
  }

  async function selectFile() {
    const path = await window.electronAPI?.blcuSelectFile?.();
    if (!path) return;
    setFilePath(path);
    setFileName(path.split(/[/\\]/).pop() ?? path);
  }

  async function flash() {
    if (!filePath || !selectedBoard) return;
    const board = boards.find((b) => b.name === selectedBoard);
    if (!board) return;

    setIsFlashing(true);
    appendLog(`Flash started → ${board.name}`);

    try {
      const res = await fetch(`${BLCU_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: board.host,
          port: 69,
          remote_filename: fileName,
          local_path: filePath,
        }),
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
  const canFlash = !!filePath && !!selectedBoard && !isFlashing;

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
      </header>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Firmware">
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
