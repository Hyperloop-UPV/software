// Tab-based ADJ archive browser (Boards / Measurements / Packets / Network / Sockets / Throughput / General).
// Pure data-in component — the page hosting it owns commit-hash fetching,
// loading/error states, and header chrome.
import {
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Cpu,
  ExternalLink,
  Layers,
  Network,
  Plug,
  Server,
  TrendingUp,
} from "@workspace/ui/icons";
import { cn, getTypeBadgeClass, typeBadgeClasses } from "@workspace/ui/lib";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import type { AdjArchiveV2, AdjMeasurement, AdjPacket, AdjSocket } from "./types";
import { NetworkTab } from "./NetworkTab";
import { SocketsTab } from "./SocketsTab";
import { ThroughputTab } from "./ThroughputTab";
import { BoardChip, EmptyState, Highlight, ResultCount, SearchInput, SortableHeader, type SortDir } from "./ui";
import { useKeyboardSearch } from "./useKeyboardSearch";

// ─── types ───────────────────────────────────────────────────────────────────

export type BoardMeta = {
  name: string;
  id: number;
  ip: string;
  measurements: AdjMeasurement[];
  packets: AdjPacket[];
  orders: AdjPacket[];
  sockets: AdjSocket[];
};

type SortKey = "board" | "name" | "type" | "units" | "id";

// ─── data helpers ─────────────────────────────────────────────────────────────

export function extractBoards(adjData: AdjArchiveV2): BoardMeta[] {
  return Object.entries(adjData.boards)
    .map(([boardName, boardGroup]) => {
      const g = boardGroup as Record<string, unknown>;
      const info = g[boardName] as { board_id: number; board_ip: string } | undefined;
      return {
        name: boardName,
        id: info?.board_id ?? 0,
        ip: info?.board_ip ?? "—",
        measurements: (g[`${boardName}_measurements`] as AdjMeasurement[] | undefined) ?? [],
        packets: (g["packets"] as AdjPacket[] | undefined) ?? [],
        orders: (g["orders"] as AdjPacket[] | undefined) ?? [],
        sockets: (g["sockets"] as AdjSocket[] | undefined) ?? [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeType(raw: string): keyof typeof typeBadgeClasses {
  const t = raw.toLowerCase();
  if (["float", "float32", "float64"].includes(t)) return "float";
  if (["int", "integer", "int8", "int16", "int32", "int64"].includes(t)) return "integer";
  if (["uint8", "uint16", "uint32", "uint64"].includes(t)) return "uint";
  if (["enum", "string"].includes(t)) return "enum";
  if (["bool", "boolean"].includes(t)) return "boolean";
  return "unknown";
}

function exportCSV(rows: { board: string; name: string; type?: string; displayUnits?: string; id: string }[], filename: string) {
  const header = ["Board", "Name", "Type", "Units", "ID"].join(",");
  const lines = rows.map((r) => [r.board, r.name, r.type ?? "", r.displayUnits ?? "", r.id].map((v) => `"${v}"`).join(","));
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── atom components ─────────────────────────────────────────────────────────

function TypeChip({
  type,
  active,
  count,
  onClick,
}: {
  type: keyof typeof typeBadgeClasses;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-all",
        active ? typeBadgeClasses[type] : "border-border text-muted-foreground opacity-40 hover:opacity-70",
      )}
    >
      {type}
      <span className="opacity-70">{count}</span>
    </button>
  );
}

function FilterPills({
  activeBoards,
  activeTypes,
  onClearBoard,
  onClearType,
  onClearAll,
}: {
  activeBoards: Set<string>;
  activeTypes: Set<string>;
  onClearBoard: (b: string) => void;
  onClearType: (t: string) => void;
  onClearAll: () => void;
}) {
  if (activeBoards.size === 0 && activeTypes.size === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-[10px]">Filters:</span>
      {[...activeBoards].map((b) => (
        <span key={b} className="border-primary/40 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
          {b}
          <button type="button" onClick={() => onClearBoard(b)} className="hover:text-destructive leading-none">✕</button>
        </span>
      ))}
      {[...activeTypes].map((t) => (
        <span key={t} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", typeBadgeClasses[t as keyof typeof typeBadgeClasses])}>
          {t}
          <button type="button" onClick={() => onClearType(t)} className="hover:opacity-70 leading-none">✕</button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="text-muted-foreground hover:text-destructive text-[10px] underline underline-offset-2">
        clear all
      </button>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <button type="button" onClick={copy} title="Copy" className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors">
      {copied ? <span className="text-primary text-[10px]">✓ copied</span> : value}
    </button>
  );
}

// ─── Boards tab ───────────────────────────────────────────────────────────────

function BoardsTab({
  boards,
  onJumpToMeasurements,
}: {
  boards: BoardMeta[];
  onJumpToMeasurements: (boardName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardSearch(inputRef);

  const filtered = useMemo(
    () => boards.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())),
    [boards, query],
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Filter boards… ( / )" inputRef={inputRef} />
        <ResultCount n={filtered.length} total={boards.length} />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {filtered.map((board) => {
          const expanded = expandedBoard === board.name;
          return (
            <div key={board.name} className="bg-muted/20 overflow-hidden rounded-lg border">
              {/* Header row */}
              <button
                type="button"
                onClick={() => setExpandedBoard(expanded ? null : board.name)}
                className="hover:bg-muted/30 flex w-full items-center gap-2 p-3 text-left transition-colors"
              >
                {expanded ? <ChevronDown className="text-muted-foreground size-3.5 shrink-0" /> : <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />}
                <Cpu className="text-primary size-4 shrink-0" />
                <span className="font-semibold">{board.name}</span>
                <Badge variant="secondary" className="ml-auto font-mono text-[10px]">ID {board.id}</Badge>
                <Badge variant="outline" className="font-mono text-[10px]">{board.ip}</Badge>
              </button>

              {/* Stats row */}
              <div className="border-t px-3 py-2">
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <span><span className="text-foreground font-semibold">{board.measurements.length}</span> measurements</span>
                  <span><span className="text-foreground font-semibold">{board.packets.length}</span> packets</span>
                  <span><span className="text-foreground font-semibold">{board.orders.length}</span> orders</span>
                  <button
                    type="button"
                    onClick={() => onJumpToMeasurements(board.name)}
                    className="text-primary ml-auto flex items-center gap-1 text-[10px] hover:underline"
                  >
                    View measurements <ExternalLink className="size-2.5" />
                  </button>
                </div>
              </div>

              {/* Expanded: measurements list — scrollable so long boards don't get cut off */}
              {expanded && board.measurements.length > 0 && (
                <div className="max-h-[20rem] overflow-y-auto border-t">
                  {board.measurements.map((m) => (
                    <div key={m.id} className="hover:bg-muted/30 flex items-center gap-2 border-b px-3 py-1.5 text-xs last:border-0">
                      <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                      {m.type && (
                        <Badge variant="secondary" className={cn("shrink-0 rounded px-1 text-[9px] font-bold uppercase leading-none", getTypeBadgeClass(m.type))}>
                          {m.type}
                        </Badge>
                      )}
                      {m.displayUnits && <span className="text-muted-foreground shrink-0 text-[10px]">{m.displayUnits}</span>}
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{m.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <EmptyState text="No boards match." />}
      </div>
    </div>
  );
}

// ─── Measurements tab ─────────────────────────────────────────────────────────

function MeasurementsTab({
  boards,
  initialBoardFilter,
  initialVariableFilter,
  packetLabel,
}: {
  boards: BoardMeta[];
  initialBoardFilter: Set<string>;
  initialVariableFilter: Set<string>;
  packetLabel: string | null;
}) {
  const [query, setQuery] = useState("");
  const [activeBoards, setActiveBoards] = useState<Set<string>>(initialBoardFilter);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [activeVariables, setActiveVariables] = useState<Set<string>>(initialVariableFilter);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardSearch(inputRef);

  const allRows = useMemo(
    () => boards.flatMap((b) => b.measurements.map((m) => ({ board: b.name, ...m }))),
    [boards],
  );

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<keyof typeof typeBadgeClasses, number>> = {};
    for (const r of allRows) {
      const t = normalizeType(r.type ?? "");
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [allRows]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allRows
      .filter((r) => {
        if (activeBoards.size > 0 && !activeBoards.has(r.board)) return false;
        if (activeTypes.size > 0 && !activeTypes.has(normalizeType(r.type ?? ""))) return false;
        if (activeVariables.size > 0 && !activeVariables.has(r.id)) return false;
        if (q && !r.name.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.board.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const va = (sortKey === "units" ? (a.displayUnits ?? "") : sortKey === "type" ? (a.type ?? "") : String(a[sortKey as keyof typeof a] ?? "")).toLowerCase();
        const vb = (sortKey === "units" ? (b.displayUnits ?? "") : sortKey === "type" ? (b.type ?? "") : String(b[sortKey as keyof typeof b] ?? "")).toLowerCase();
        return va.localeCompare(vb) * dir;
      });
  }, [allRows, query, activeBoards, activeTypes, activeVariables, sortKey, sortDir]);

  const toggleBoard = (name: string) =>
    setActiveBoards((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });

  const toggleType = (t: string) =>
    setActiveTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  const handleSort = (col: SortKey) => {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  };

  const q = query.toLowerCase();

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Search + export */}
      <div className="flex items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, ID, board… ( / )" inputRef={inputRef} />
        <ResultCount n={filtered.length} total={allRows.length} />
        <button
          type="button"
          onClick={() => exportCSV(filtered, "measurements.csv")}
          className="text-muted-foreground hover:text-foreground shrink-0 text-[11px] underline underline-offset-2 transition-colors"
        >
          CSV
        </button>
      </div>

      {/* Board chips */}
      <div className="flex flex-wrap gap-1.5">
        {boards.map((b) => (
          <BoardChip key={b.name} name={b.name} active={activeBoards.has(b.name)} onClick={() => toggleBoard(b.name)} />
        ))}
      </div>

      {/* Type chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(typeBadgeClasses) as (keyof typeof typeBadgeClasses)[])
          .filter((t) => (typeCounts[t] ?? 0) > 0)
          .map((t) => (
            <TypeChip key={t} type={t} active={activeTypes.has(t)} count={typeCounts[t] ?? 0} onClick={() => toggleType(t)} />
          ))}
      </div>

      {/* Packet-jump pill — separate from FilterPills since it's a single named
          value (the packet that triggered the jump), not a board/type set. */}
      {packetLabel && activeVariables.size > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="border-primary/40 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
            Packet: {packetLabel}
            <button
              type="button"
              onClick={() => setActiveVariables(new Set())}
              className="hover:text-destructive leading-none"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {/* Active filter pills */}
      <FilterPills
        activeBoards={activeBoards}
        activeTypes={activeTypes}
        onClearBoard={toggleBoard}
        onClearType={toggleType}
        onClearAll={() => { setActiveBoards(new Set()); setActiveTypes(new Set()); setActiveVariables(new Set()); }}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto pr-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr className="border-b">
              <SortableHeader label="Board" col="board" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Name"  col="name"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Type"  col="type"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Units" col="units" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="ID"    col="id"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const rowKey = `${r.board}/${r.id}`;
              const expanded = expandedId === rowKey;
              const isEnum = r.type === "enum";
              return (
                <Fragment key={rowKey}>
                  <tr
                    onClick={() => setExpandedId(expanded ? null : rowKey)}
                    className={cn(
                      "border-b transition-colors",
                      (isEnum || r.podUnits) ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/20",
                      expanded && "bg-muted/20",
                    )}
                  >
                    <td className="text-muted-foreground py-2 pr-3 font-mono">
                      <Highlight text={r.board} query={q} />
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      <div className="flex items-center gap-1">
                        <Highlight text={r.name} query={q} />
                        {(isEnum || r.podUnits) && (
                          <ChevronDown className={cn("text-muted-foreground size-3 shrink-0 transition-transform", expanded && "rotate-180")} />
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {r.type && (
                        <Badge variant="secondary" className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none", getTypeBadgeClass(r.type))}>
                          {r.type}
                        </Badge>
                      )}
                    </td>
                    <td className="text-muted-foreground py-2 pr-3">{r.displayUnits ?? "—"}</td>
                    <td className="text-muted-foreground py-2 font-mono text-[10px]">
                      <Highlight text={r.id} query={q} />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/10">
                      <td colSpan={5} className="px-3 pb-3 pt-1">
                        <div className="space-y-1.5 text-[11px]">
                          {r.podUnits && (
                            <p className="text-muted-foreground">
                              Pod units: <span className="text-foreground font-mono">{r.podUnits}</span>
                              {r.displayUnits && r.displayUnits !== r.podUnits && (
                                <> → <span className="text-foreground font-mono">{r.displayUnits}</span></>
                              )}
                            </p>
                          )}
                          {isEnum && r.enumValues && r.enumValues.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {r.enumValues.map((v, i) => (
                                <span key={v} className="bg-violet-500/10 text-violet-400 border-violet-500/30 rounded border px-1.5 py-0.5 font-mono text-[10px]">
                                  {i}: {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState text="No measurements match the current filters." />}
      </div>
    </div>
  );
}

// ─── Packets tab ──────────────────────────────────────────────────────────────

function PacketsTab({
  boards,
  onJumpToMeasurements,
}: {
  boards: BoardMeta[];
  onJumpToMeasurements: (boardName: string, packetName: string, variableIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"packets" | "orders">("packets");
  const [activeBoards, setActiveBoards] = useState<Set<string>>(new Set());
  const [sortByPeriod, setSortByPeriod] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardSearch(inputRef);

  const allRows = useMemo(
    () => boards.flatMap((b) => (kind === "packets" ? b.packets : b.orders).map((p) => ({ board: b.name, ...p }))),
    [boards, kind],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allRows
      .filter((r) => {
        if (activeBoards.size > 0 && !activeBoards.has(r.board)) return false;
        if (q && !r.name.toLowerCase().includes(q) && !r.board.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortByPeriod) return (a.period ?? Infinity) - (b.period ?? Infinity);
        return a.name.localeCompare(b.name);
      });
  }, [allRows, query, activeBoards, sortByPeriod]);

  const toggleBoard = (name: string) =>
    setActiveBoards((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });

  const q = query.toLowerCase();

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder={`Search ${kind}… ( / )`} inputRef={inputRef} />
        <div className="flex shrink-0 overflow-hidden rounded-md border text-[11px]">
          {(["packets", "orders"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setQuery(""); setActiveBoards(new Set()); }}
              className={cn("px-3 py-1.5 capitalize transition-colors", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {k}
            </button>
          ))}
        </div>
        <ResultCount n={filtered.length} total={allRows.length} />
      </div>

      {/* Board chips + sort toggle */}
      <div className="flex flex-wrap items-center gap-1.5">
        {boards.map((b) => (
          <BoardChip key={b.name} name={b.name} active={activeBoards.has(b.name)} onClick={() => toggleBoard(b.name)} />
        ))}
        <button
          type="button"
          onClick={() => setSortByPeriod((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors",
            sortByPeriod ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:opacity-80",
          )}
        >
          Sort by period
        </button>
      </div>

      {/* Active filter pills */}
      <FilterPills
        activeBoards={activeBoards}
        activeTypes={new Set()}
        onClearBoard={toggleBoard}
        onClearType={() => {}}
        onClearAll={() => setActiveBoards(new Set())}
      />

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {filtered.map((r, i) => {
          const hasVariables = r.variables && r.variables.length > 0;
          return (
            <div
              key={i}
              onClick={hasVariables ? () => onJumpToMeasurements(r.board, r.name, r.variables) : undefined}
              className={cn(
                "bg-muted/20 rounded-lg border px-3 py-2 transition-colors",
                hasVariables && "cursor-pointer hover:bg-muted/30",
              )}
              title={hasVariables ? "View measurements" : undefined}
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="font-semibold"><Highlight text={r.name} query={q} /></span>
                <Badge variant="secondary" className="font-mono text-[10px]">ID {r.id}</Badge>
                {r.period != null && (
                  <Badge variant="outline" className="font-mono text-[10px]">{r.period} {r.period_type}</Badge>
                )}
                {r.socket && (
                  <Badge variant="outline" className="font-mono text-[10px]">{r.socket}</Badge>
                )}
                <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                  <Highlight text={r.board} query={q} />
                </span>
              </div>
              {hasVariables && (
                <div className="flex flex-wrap gap-1">
                  {r.variables.map((v) => (
                    <span key={v} className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">{v}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <EmptyState text={`No ${kind} match the current filters.`} />}
      </div>
    </div>
  );
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralSection({
  title,
  data,
  query,
}: {
  title: string;
  data: Record<string, string | number>;
  query: string;
}) {
  const entries = Object.entries(data).filter(
    ([k, v]) => !query || k.toLowerCase().includes(query) || String(v).toLowerCase().includes(query),
  );
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-widest">
        {title} <span className="opacity-50">({entries.length})</span>
      </h3>
      <div className="bg-muted/20 divide-y rounded-lg border">
        {entries.map(([k, v]) => (
          <div key={k} className="hover:bg-muted/30 flex items-center gap-2 px-3 py-1.5 transition-colors">
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{k}</span>
            <CopyValue value={String(v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneralTab({ adjData }: { adjData: AdjArchiveV2 }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useKeyboardSearch(inputRef);
  const q = query.toLowerCase();
  const { ports, addresses, units, message_ids } = adjData.general_info;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* wrap in a row so flex-1 on SearchInput grows horizontally, not vertically */}
      <div className="flex shrink-0 items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Filter keys or values… ( / )" inputRef={inputRef} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <GeneralSection title="Ports" data={ports} query={q} />
        <GeneralSection title="Addresses" data={addresses} query={q} />
        <GeneralSection title="Units" data={units} query={q} />
        <GeneralSection title="Message IDs" data={message_ids} query={q} />
      </div>
    </div>
  );
}

// ─── main tabs component ─────────────────────────────────────────────────────

export const AdjViewerTabs = ({ adjData }: { adjData: AdjArchiveV2 }) => {
  const boards = useMemo(() => extractBoards(adjData), [adjData]);
  const [archive, setArchive] = useState({ data: adjData, revision: 0 });

  // Reset the scenario for every newly loaded archive, even when board names
  // are unchanged. Keep the active tab so users can compare commits in place.
  if (archive.data !== adjData) {
    setArchive({ data: adjData, revision: archive.revision + 1 });
  }

  // Lifted state for cross-tab navigation
  const [activeTab, setActiveTab] = useState("boards");
  const [jumpBoardFilter, setJumpBoardFilter] = useState<Set<string>>(new Set());
  const [jumpVariableFilter, setJumpVariableFilter] = useState<Set<string>>(new Set());
  const [jumpPacketLabel, setJumpPacketLabel] = useState<string | null>(null);

  const handleJumpToMeasurements = useCallback((boardName: string) => {
    setJumpBoardFilter(new Set([boardName]));
    setJumpVariableFilter(new Set());
    setJumpPacketLabel(null);
    setActiveTab("measurements");
  }, []);

  const handleJumpToPacketMeasurements = useCallback(
    (boardName: string, packetName: string, variableIds: string[]) => {
      setJumpBoardFilter(new Set([boardName]));
      setJumpVariableFilter(new Set(variableIds));
      setJumpPacketLabel(packetName);
      setActiveTab("measurements");
    },
    [],
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 min-w-0 flex-1 flex-col gap-0">
      {/* On narrow screens the bar scrolls sideways by itself instead of widening the page. */}
      <TabsList className="mb-4 max-w-full shrink-0 justify-start overflow-x-auto [scrollbar-width:none]">
        <TabsTrigger value="boards" className="flex-none gap-1.5 text-xs">
          <Cpu className="size-3.5" /> Boards
        </TabsTrigger>
        <TabsTrigger value="measurements" className="flex-none gap-1.5 text-xs">
          <Activity className="size-3.5" /> Measurements
        </TabsTrigger>
        <TabsTrigger value="packets" className="flex-none gap-1.5 text-xs">
          <Layers className="size-3.5" /> Packets
        </TabsTrigger>
        <TabsTrigger value="network" className="flex-none gap-1.5 text-xs">
          <Network className="size-3.5" /> Network
        </TabsTrigger>
        <TabsTrigger value="sockets" className="flex-none gap-1.5 text-xs">
          <Plug className="size-3.5" /> Sockets
        </TabsTrigger>
        <TabsTrigger value="throughput" className="flex-none gap-1.5 text-xs">
          <TrendingUp className="size-3.5" /> Throughput
        </TabsTrigger>
        <TabsTrigger value="general" className="flex-none gap-1.5 text-xs">
          <Server className="size-3.5" /> General
        </TabsTrigger>
      </TabsList>

      <TabsContent value="boards" className="min-h-0 flex-1 overflow-hidden pb-4">
        <BoardsTab boards={boards} onJumpToMeasurements={handleJumpToMeasurements} />
      </TabsContent>
      {/* key remounts MeasurementsTab on cross-tab jump so initialBoardFilter/initialVariableFilter take effect cleanly */}
      <TabsContent value="measurements" className="min-h-0 flex-1 overflow-hidden pb-4">
        <MeasurementsTab
          key={`${[...jumpBoardFilter].join(",")}|${[...jumpVariableFilter].join(",")}`}
          boards={boards}
          initialBoardFilter={jumpBoardFilter}
          initialVariableFilter={jumpVariableFilter}
          packetLabel={jumpPacketLabel}
        />
      </TabsContent>
      <TabsContent value="packets" className="min-h-0 flex-1 overflow-hidden pb-4">
        <PacketsTab boards={boards} onJumpToMeasurements={handleJumpToPacketMeasurements} />
      </TabsContent>
      <TabsContent value="network" className="min-h-0 flex-1 overflow-hidden pb-4">
        <NetworkTab boards={boards} generalInfo={adjData.general_info} />
      </TabsContent>
      <TabsContent value="sockets" className="min-h-0 flex-1 overflow-hidden pb-4">
        <SocketsTab
          boards={boards}
          generalInfo={adjData.general_info}
          onJumpToMeasurements={handleJumpToPacketMeasurements}
        />
      </TabsContent>
      {/* No overflow-hidden here: it would trap ThroughputTab's sticky panel. */}
      <TabsContent value="throughput" className="min-h-0 flex-1 pb-4">
        <ThroughputTab key={archive.revision} boards={boards} />
      </TabsContent>
      <TabsContent value="general" className="min-h-0 flex-1 overflow-hidden pb-4">
        <GeneralTab adjData={adjData} />
      </TabsContent>
    </Tabs>
  );
};
