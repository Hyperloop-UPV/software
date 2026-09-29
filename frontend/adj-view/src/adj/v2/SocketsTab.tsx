// Sockets tab: every socket declared in the ADJ, one row each, with the board
// side, where it points, the general_info port name, and the packets that use it.
// All socket interpretation comes from sockets.ts, shared with the Network tab.
import { Badge } from "@workspace/ui/components";
import { AlertTriangle, ChevronDown, ExternalLink } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { Fragment, useMemo, useRef, useState } from "react";
import type { BoardMeta } from "./AdjViewerTabs";
import {
  boardPort,
  portNames,
  resolveTarget,
  socketRole,
  type SocketRole,
  type SocketTarget,
} from "./sockets";
import type { AdjArchiveV2, AdjPacket, AdjSocket } from "./types";
import { BoardChip, EmptyState, Highlight, ResultCount, SearchInput, SortableHeader, type SortDir } from "./ui";
import { useKeyboardSearch } from "./useKeyboardSearch";

type SortKey = "board" | "name" | "type" | "local" | "remote" | "packets";

const ROLES: SocketRole[] = ["TCP server", "TCP client", "UDP", "Unknown"];

// Same protocol colours as the Network tab's arrows, so the two tabs read alike.
const ROLE_DOT: Record<SocketRole, string> = {
  "TCP server": "var(--foreground)",
  "TCP client": "var(--foreground)",
  UDP: "var(--primary)",
  Unknown: "var(--muted-foreground)",
};

type SocketUser = AdjPacket & { kind: "packet" | "order" };

interface SocketRow {
  key: string;
  board: string;
  boardIp: string;
  socket: AdjSocket;
  role: SocketRole;
  localPort?: number;
  target?: SocketTarget;
  portNames: string[];
  users: SocketUser[];
  duplicate: boolean;
}

interface UnknownReference {
  board: string;
  socket: string;
  users: SocketUser[];
}

function buildRows(boards: BoardMeta[], generalInfo: AdjArchiveV2["general_info"]) {
  const addresses = generalInfo.addresses ?? {};
  const ports = generalInfo.ports ?? {};
  const boardByIp = new Map(boards.map((b) => [b.ip, b.name]));
  const rows: SocketRow[] = [];
  const unknown: UnknownReference[] = [];

  for (const board of boards) {
    const users: SocketUser[] = [
      ...board.packets.map((p) => ({ ...p, kind: "packet" as const })),
      ...board.orders.map((p) => ({ ...p, kind: "order" as const })),
    ];
    const nameCount = new Map<string, number>();
    for (const s of board.sockets) nameCount.set(s.name, (nameCount.get(s.name) ?? 0) + 1);

    board.sockets.forEach((socket, i) => {
      const localPort = boardPort(socket);
      rows.push({
        key: `${board.name}/${socket.name}/${i}`,
        board: board.name,
        boardIp: board.ip,
        socket,
        role: socketRole(socket.type),
        localPort,
        target: socket.remote_ip ? resolveTarget(socket.remote_ip, addresses, boardByIp) : undefined,
        portNames: [...new Set([...portNames(localPort, ports), ...portNames(socket.remote_port, ports)])],
        users: users.filter((u) => u.socket === socket.name),
        duplicate: (nameCount.get(socket.name) ?? 0) > 1,
      });
    });

    const byMissing = new Map<string, SocketUser[]>();
    for (const u of users) {
      if (u.socket && !nameCount.has(u.socket)) byMissing.set(u.socket, [...(byMissing.get(u.socket) ?? []), u]);
    }
    for (const [socket, list] of byMissing) unknown.push({ board: board.name, socket, users: list });
  }
  return { rows, unknown };
}

function remoteText(r: SocketRow): string {
  if (!r.target) return r.role === "TCP server" ? "any client" : "";
  const port = r.socket.remote_port != null ? `:${r.socket.remote_port}` : "";
  return r.target.label === r.target.ip ? `${r.target.ip}${port}` : `${r.target.label} ${r.target.ip}${port}`;
}

function csvCell(v: string | number | undefined) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function exportSocketsCSV(rows: SocketRow[]) {
  const header = ["Board", "Socket", "Type", "Role", "Board IP", "Board port", "Remote", "Remote IP", "Remote port", "Port names", "Packets"];
  const lines = rows.map((r) =>
    [
      r.board,
      r.socket.name,
      r.socket.type,
      r.role,
      r.boardIp,
      r.localPort,
      r.target?.label,
      r.target?.ip,
      r.socket.remote_port,
      r.portNames.join(" "),
      r.users.map((u) => u.name).join("; "),
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sockets.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── pieces ──────────────────────────────────────────────────────────────────

function RoleChip({
  role,
  count,
  active,
  onClick,
}: {
  role: SocketRole;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground opacity-60 hover:opacity-90",
      )}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: ROLE_DOT[role] }} />
      {role}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function RoleBadge({ role, type }: { role: SocketRole; type: string }) {
  return (
    <span title={`${type} in the ADJ`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px]">
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: ROLE_DOT[role] }} />
      {role}
    </span>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
      <AlertTriangle className="size-3 shrink-0" />
      {children}
    </span>
  );
}

function UserList({
  board,
  users,
  onJumpToMeasurements,
}: {
  board: string;
  users: SocketUser[];
  onJumpToMeasurements: (boardName: string, packetName: string, variableIds: string[]) => void;
}) {
  return (
    <ul className="divide-y rounded-md border">
      {users.map((u) => {
        const hasVariables = u.variables && u.variables.length > 0;
        return (
          <li key={`${u.kind}-${u.id}`}>
            <button
              type="button"
              disabled={!hasVariables}
              onClick={() => onJumpToMeasurements(board, u.name, u.variables)}
              className="hover:bg-muted/30 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
              <span className="text-muted-foreground shrink-0">{u.kind}</span>
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">ID {u.id}</Badge>
              <span className="text-muted-foreground w-20 shrink-0 text-right tabular-nums">
                {u.period != null ? `every ${u.period} ${u.period_type ?? ""}` : "no period"}
              </span>
              <span className="text-muted-foreground w-24 shrink-0 text-right">
                {hasVariables ? `${u.variables.length} variable${u.variables.length === 1 ? "" : "s"}` : "no variables"}
              </span>
              <ExternalLink className={cn("size-3 shrink-0", hasVariables ? "text-primary" : "opacity-0")} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── tab ─────────────────────────────────────────────────────────────────────

export function SocketsTab({
  boards,
  generalInfo,
  onJumpToMeasurements,
}: {
  boards: BoardMeta[];
  generalInfo: AdjArchiveV2["general_info"];
  onJumpToMeasurements: (boardName: string, packetName: string, variableIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeBoards, setActiveBoards] = useState<Set<string>>(new Set());
  const [activeRoles, setActiveRoles] = useState<Set<SocketRole>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("board");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useKeyboardSearch(inputRef);

  const { rows, unknown } = useMemo(() => buildRows(boards, generalInfo), [boards, generalInfo]);

  const roleCounts = useMemo(() => {
    const counts = new Map<SocketRole, number>();
    for (const r of rows) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
    return counts;
  }, [rows]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const sortValue = (r: SocketRow): string | number => {
      switch (sortKey) {
        case "board": return r.board;
        case "name": return r.socket.name;
        case "type": return r.role;
        case "local": return r.localPort ?? Infinity;
        case "remote": return remoteText(r);
        case "packets": return r.users.length;
      }
    };
    return rows
      .filter((r) => {
        if (activeBoards.size > 0 && !activeBoards.has(r.board)) return false;
        if (activeRoles.size > 0 && !activeRoles.has(r.role)) return false;
        if (!q) return true;
        const haystack = [r.board, r.socket.name, r.socket.type, r.role, r.boardIp, r.localPort, remoteText(r), r.socket.remote_port, ...r.portNames]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const va = sortValue(a);
        const vb = sortValue(b);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        // Ties keep ADJ order within a board.
        return cmp * dir || a.board.localeCompare(b.board) || rows.indexOf(a) - rows.indexOf(b);
      });
  }, [rows, activeBoards, activeRoles, q, sortKey, sortDir]);

  const toggleBoard = (name: string) =>
    setActiveBoards((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const toggleRole = (role: SocketRole) =>
    setActiveRoles((s) => { const n = new Set(s); if (n.has(role)) n.delete(role); else n.add(role); return n; });
  const handleSort = (col: SortKey) => {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  };

  const hasFilters = activeBoards.size > 0 || activeRoles.size > 0;
  const visibleUnknown = unknown.filter((u) => activeBoards.size === 0 || activeBoards.has(u.board));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search board, socket, IP, port… ( / )" inputRef={inputRef} />
        <ResultCount n={filtered.length} total={rows.length} />
        <button
          type="button"
          onClick={() => exportSocketsCSV(filtered)}
          className="text-muted-foreground hover:text-foreground shrink-0 text-[11px] underline underline-offset-2 transition-colors"
        >
          CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {boards.map((b) => (
          <BoardChip key={b.name} name={b.name} active={activeBoards.has(b.name)} onClick={() => toggleBoard(b.name)} />
        ))}
        <span className="bg-border mx-1 h-4 w-px" aria-hidden />
        {ROLES.filter((role) => (roleCounts.get(role) ?? 0) > 0).map((role) => (
          <RoleChip key={role} role={role} count={roleCounts.get(role) ?? 0} active={activeRoles.has(role)} onClick={() => toggleRole(role)} />
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setActiveBoards(new Set()); setActiveRoles(new Set()); }}
            className="text-muted-foreground hover:text-destructive ml-1 text-[10px] underline underline-offset-2"
          >
            clear filters
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto pr-1">
        <table className="w-full min-w-[46rem] text-xs">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr className="border-b">
              <SortableHeader label="Board" col="board" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Socket" col="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Board side" col="local" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Remote" col="remote" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="bg-background text-muted-foreground pb-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider">
                Port name
              </th>
              <SortableHeader label="Packets" col="packets" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isOpen = expanded === r.key;
              const canExpand = r.users.length > 0;
              return (
                <Fragment key={r.key}>
                  <tr
                    onClick={canExpand ? () => setExpanded(isOpen ? null : r.key) : undefined}
                    className={cn(
                      "border-b align-top transition-colors",
                      canExpand ? "hover:bg-muted/30 cursor-pointer" : "hover:bg-muted/20",
                      isOpen && "bg-muted/20",
                    )}
                  >
                    <td className="text-muted-foreground py-2 pr-3 font-mono">
                      <Highlight text={r.board} query={q} />
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium"><Highlight text={r.socket.name} query={q} /></div>
                      {r.duplicate && <Warning>Name used twice on this board</Warning>}
                    </td>
                    <td className="py-2 pr-3">
                      <RoleBadge role={r.role} type={r.socket.type} />
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums">
                      <span className="text-muted-foreground"><Highlight text={r.boardIp} query={q} /></span>
                      {r.localPort != null ? (
                        <>:<Highlight text={String(r.localPort)} query={q} /></>
                      ) : (
                        <span className="text-muted-foreground">:?</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {r.target ? (
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          {r.target.label !== r.target.ip && (
                            <span className="font-medium"><Highlight text={r.target.label} query={q} /></span>
                          )}
                          <span className={cn("font-mono tabular-nums", r.target.label !== r.target.ip && "text-muted-foreground")}>
                            <Highlight text={r.target.ip} query={q} />
                            {r.socket.remote_port != null && `:${r.socket.remote_port}`}
                          </span>
                          {r.target.kind === "ip" && <Warning>Not a known address or board</Warning>}
                        </div>
                      ) : r.role === "TCP server" ? (
                        <span className="text-muted-foreground" title="The board listens; the ADJ doesn't record who connects">
                          Any client
                        </span>
                      ) : (
                        <Warning>No remote IP</Warning>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px]">
                      {r.portNames.length > 0 ? (
                        <Highlight text={r.portNames.join(", ")} query={q} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 tabular-nums">
                      {canExpand ? (
                        <span className="inline-flex items-center gap-1">
                          {r.users.length}
                          <ChevronDown className={cn("text-muted-foreground size-3 transition-transform", isOpen && "rotate-180")} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/10 border-b">
                      <td colSpan={7} className="px-3 pb-3 pt-1">
                        <p className="text-muted-foreground mb-1.5 text-[11px]">
                          Packets and orders of {r.board} that name <span className="text-foreground font-mono">{r.socket.name}</span>. Click one to see its measurements.
                        </p>
                        <UserList board={r.board} users={r.users} onJumpToMeasurements={onJumpToMeasurements} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState text="No sockets match the current filters." />}

        {visibleUnknown.length > 0 && (
          <section className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
              Unknown socket references
            </h3>
            <p className="text-muted-foreground mb-2 text-[11px]">
              These packets name a socket that their board doesn&apos;t define.
            </p>
            <div className="space-y-2">
              {visibleUnknown.map((u) => (
                <div key={`${u.board}/${u.socket}`}>
                  <p className="mb-1 text-[11px]">
                    <span className="font-mono">{u.board}</span> → <span className="font-mono">{u.socket}</span>
                  </p>
                  <UserList board={u.board} users={u.users} onJumpToMeasurements={onJumpToMeasurements} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
