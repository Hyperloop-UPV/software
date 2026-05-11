import { useRef } from "react"
import { useNavigate } from "react-router"
import {
  ArrowLeft,
  FileCode2,
  LoaderCircle,
  Upload,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/shadcn/badge"
import { Button } from "@workspace/ui/components/shadcn/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/shadcn/card"
import { Separator } from "@workspace/ui/components/shadcn/separator"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/table"
import { Textarea } from "@workspace/ui/components/shadcn/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { useFlashStation } from "./use-flash-station"
import { BoardCard } from "./components/board-card"
import { ResultRow } from "./components/result-row"
import { SectionCard } from "./components/section-card"
import {
  getConnectedBoardCount,
  getConnectedBoardIds,
  getSelectedFileLabel,
} from "./utils"

/**
 * Main flash station page.
 *
 * Left column: file picker, flash controls, and the live log.
 * Right column: board grid and the results history table.
 */
export function FlashStationView() {
  const station = useFlashStation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()

  // Derive a few convenience values so the JSX below stays readable.
  const selectedFileLabel = getSelectedFileLabel(station)
  const connectedBoardIds = getConnectedBoardIds(station.boards)
  const connectedCount = getConnectedBoardCount(station.boards)

  const selectedBoards = station.boards.filter((board) =>
    station.selectedBoardIds.includes(board.id)
  )

  /**
   * Two-stage file picker:
   *
   * 1. Try the Electron native dialog first (blcuSelectFile).
   *    If the user picks a file there, `chooseFile()` returns the basename
   *    and we're done.
   * 2. If the Electron API isn't available or the user cancels, fall back
   *    to the hidden HTML <input> so the app still works in a browser.
   */
  async function openFilePicker() {
    const fileName = await station.chooseFile()
    if (fileName) return // Electron dialog succeeded — no need for fallback.
    fileInputRef.current?.click()
  }

  /** True if the Flash button should be disabled. */
  const cantFlash =
    !selectedBoards.length || station.isFlashing || !station.selectedFileName

  return (
    <main className="min-h-full w-full p-4">
      {/* Top bar: title + back button. */}
      <header className="mb-4 flex items-center gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Flash View
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a file, select connected boards, and flash.
          </p>
        </div>

        <div className="h-[3px] flex-1 rounded-full bg-primary/25" />

        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ---------- Left column ---------- */}
        <div className="space-y-4">
          <SectionCard title="Code">
            {/* Hidden fallback input for browser-mode file picking. */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".bin,.hex,.elf"
              className="hidden"
              onClick={(event) => {
                // Reset the input so onChange fires even if the same file is
                // picked twice in a row.
                event.currentTarget.value = ""
              }}
              onChange={(event) =>
                station.setSelectedFile(event.target.files?.[0] ?? null)
              }
            />

            <Button className="w-full" onClick={openFilePicker}>
              <FileCode2 className="size-4" />
              Choose File
            </Button>

            <ReadOnlyField label="Selected file" value={selectedFileLabel} mono />
          </SectionCard>

          <SectionCard title="Flash">
            <div className="grid gap-2 text-sm">
              <KeyValueRow label="File" value={selectedFileLabel} />
              <KeyValueRow
                label="Board"
                value={selectedBoards.length ? selectedBoards[0].name : "None"}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={station.startFlash}
                disabled={cantFlash}
              >
                {station.isFlashing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Flash
              </Button>
              <Button variant="outline" onClick={station.reset}>
                Reset
              </Button>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => station.selectBoards(connectedBoardIds)}
            >
              Use First Connected Board
            </Button>
          </SectionCard>

          <SectionCard title="Log">
            <Textarea
              readOnly
              value={station.log.join("\n")}
              className="min-h-40 resize-none border-border/80 bg-[#f7f9fb] font-mono text-xs text-foreground"
            />
          </SectionCard>
        </div>

        {/* ---------- Right column ---------- */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg text-foreground">
                  Boards
                </CardTitle>
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/30 bg-primary/10 text-primary"
                >
                  {connectedCount} connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {station.boards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    selected={station.selectedBoardIds.includes(board.id)}
                    disabled={board.state === "offline"}
                    isFlashing={station.isFlashing}
                    activeBoardId={station.activeBoardId}
                    onSelect={station.toggleBoard}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <SectionCard title="Results">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Board</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {station.results.map((result) => (
                  <ResultRow key={result.id} result={result} />
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </div>
      </section>

      {/* Footer strip — quick summary of what's armed. */}
      <footer className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <FileCode2 className="size-3.5" />
          {selectedFileLabel}
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span>{selectedBoards.length} board(s) armed</span>
      </footer>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/*  Small presentational helpers — too simple to warrant their own files */
/* ------------------------------------------------------------------ */

/** A read-only label + value box used in the left panels. */
function ReadOnlyField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-secondary/45 px-3 py-2">
      <div className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className={cn("mt-1 text-sm text-foreground", mono && "font-mono")}>
        {value}
      </div>
    </div>
  )
}

/** A compact key/value row used in the flash summary panel. */
function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/45 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
