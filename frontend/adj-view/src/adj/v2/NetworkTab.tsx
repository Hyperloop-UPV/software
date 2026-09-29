// Network tab: a hand-built SVG schema of the pod's network topology.
// Boards on the left, central addresses (general_info.addresses) on the right,
// arrows for each board's sockets, colored by protocol. No graph library in the
// monorepo, and the node/edge count here is small enough that manual two-column
// layout is simpler than pulling one in.
import { useMemo } from "react";
import type { AdjArchiveV2 } from "./types";
import type { BoardMeta } from "./AdjViewerTabs";
import { protocolFromSocketType, type Protocol } from "./sockets";

// Hyperloop UPV's actual brand palette (no separate secondary brand color
// documented anywhere in the repo) — --primary is the brand orange, and
// --foreground pairs it with black/white, matching the logo assets under
// frontend-kit/ui/src/outreach. Both adapt automatically in light/dark mode.
const PROTOCOL_COLOR: Record<Protocol, string> = {
  TCP: "var(--foreground)", // bidirectional
  UDP: "var(--primary)", // unidirectional: board → backend
  OTHER: "var(--muted-foreground)",
};

// ─── graph model ───────────────────────────────────────────────────────────

interface DiagramNode {
  id: string;
  label: string;
  ip: string;
  boardId?: number;
  badges: string[];
}

interface DiagramEdge {
  key: string;
  from: string;
  to: string;
  protocol: Protocol;
  detail: string;
}

interface NetworkGraph {
  boardNodes: DiagramNode[];
  centralNodes: DiagramNode[];
  edges: DiagramEdge[];
}

// A socket's remote_ip may be a symbolic key into `addresses` (e.g. "backend")
// or the raw IP itself — resolve either form to a stable node id + label.
function resolveTarget(remoteIp: string, addresses: Record<string, string>) {
  if (remoteIp in addresses) {
    return { id: remoteIp, label: remoteIp, ip: addresses[remoteIp] };
  }
  const knownKey = Object.entries(addresses).find(([, ip]) => ip === remoteIp)?.[0];
  if (knownKey) {
    return { id: knownKey, label: knownKey, ip: remoteIp };
  }
  return { id: `ip:${remoteIp}`, label: remoteIp, ip: remoteIp };
}

function buildNetworkGraph(boards: BoardMeta[], generalInfo: AdjArchiveV2["general_info"]): NetworkGraph {
  const addresses = generalInfo.addresses ?? {};
  const centralMap = new Map<string, DiagramNode>();
  for (const [key, ip] of Object.entries(addresses)) {
    centralMap.set(key, { id: key, label: key, ip, badges: [] });
  }

  // A socket's remote_ip can also point at another board directly (board-to-board
  // traffic) — route those to the existing board node instead of resolveTarget's
  // "unknown external IP" fallback, which would otherwise draw a second, duplicate
  // node for an IP that's already shown on the left as a board.
  const boardIdByIp = new Map(boards.map((b) => [b.ip, b.name]));

  // Listen-only sockets (no remote_ip) have no recorded source — infer the
  // backend as the source only when there's an unambiguous one to attribute it to.
  const backendKey = "backend" in addresses ? "backend" : Object.keys(addresses).length === 1 ? Object.keys(addresses)[0] : null;

  const boardNodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  for (const board of boards) {
    const badges: string[] = [];
    for (const socket of board.sockets) {
      const protocol = protocolFromSocketType(socket.type);
      if (socket.remote_ip) {
        const targetBoardName = boardIdByIp.get(socket.remote_ip);
        let to: string;
        if (targetBoardName) {
          to = targetBoardName;
        } else {
          const target = resolveTarget(socket.remote_ip, addresses);
          if (!centralMap.has(target.id)) {
            centralMap.set(target.id, { id: target.id, label: target.label, ip: target.ip, badges: [] });
          }
          to = target.id;
        }
        edges.push({
          key: `${board.name}-${socket.name}-out`,
          from: board.name,
          to,
          protocol,
          detail: `${socket.name} · :${socket.port}`,
        });
      } else if (backendKey) {
        edges.push({
          key: `${board.name}-${socket.name}-in`,
          from: backendKey,
          to: board.name,
          protocol,
          detail: `${socket.name} · :${socket.port}`,
        });
      } else {
        badges.push(`listens :${socket.port}`);
      }
    }
    boardNodes.push({ id: board.name, label: board.name, ip: board.ip, boardId: board.id, badges });
  }

  return { boardNodes, centralNodes: [...centralMap.values()], edges };
}

// ─── layout ──────────────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 72;
const ROW_H = 116;
const PADDING = 32;
const DIAGRAM_W = 680;
// Vertical margin kept clear at the top/bottom of a node's connecting edge
// when fanning out multiple anchor points along it.
const ANCHOR_MARGIN = 16;

function columnCenterY(index: number, count: number, totalRows: number): number {
  const totalHeight = totalRows * ROW_H;
  const colHeight = count * ROW_H;
  const offset = (totalHeight - colHeight) / 2;
  return PADDING + offset + index * ROW_H + ROW_H / 2;
}

// ─── rendering ───────────────────────────────────────────────────────────────

function NodeBox({ node, x, y, central }: { node: DiagramNode; x: number; y: number; central: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y - NODE_H / 2}
        width={NODE_W}
        height={NODE_H}
        rx={10}
        style={{
          fill: central ? "var(--primary)" : "var(--foreground)",
          fillOpacity: central ? 0.1 : 0.05,
          stroke: central ? "var(--primary)" : "var(--border)",
          strokeOpacity: central ? 0.5 : 1,
        }}
        strokeWidth={1.25}
      />
      <text x={x + 12} y={y - 7} style={{ fill: "var(--foreground)" }} fontSize={13} fontWeight={600}>
        {node.label}
        {node.boardId != null ? ` · ID ${node.boardId}` : ""}
      </text>
      <text x={x + 12} y={y + 11} style={{ fill: "var(--muted-foreground)" }} fontSize={11} fontFamily="ui-monospace, monospace">
        {node.ip}
      </text>
      {node.badges.length > 0 && (
        <text x={x + 12} y={y + NODE_H / 2 - 5} style={{ fill: "var(--muted-foreground)" }} fontSize={9.5}>
          {node.badges.join(" · ")}
        </text>
      )}
    </g>
  );
}

function EdgePath({ edge, from, to }: { edge: DiagramEdge; from: { x: number; y: number }; to: { x: number; y: number } }) {
  // Board-to-board edges anchor on the same side (both x's equal), which would
  // collapse the curve into a flat line hugging the column edge — bow it out
  // toward the middle of the diagram instead so it reads as a distinct loop.
  const sameSide = from.x === to.x;
  const midX = sameSide ? from.x + 70 : (from.x + to.x) / 2;
  const color = PROTOCOL_COLOR[edge.protocol];
  const markerId = `network-arrow-${edge.protocol.toLowerCase()}`;
  return (
    <path
      d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
      fill="none"
      style={{ stroke: color, strokeOpacity: 0.8 }}
      strokeWidth={1.75}
      markerEnd={`url(#${markerId})`}
      markerStart={edge.protocol === "TCP" ? `url(#${markerId})` : undefined}
    >
      <title>{`${edge.protocol} · ${edge.detail}`}</title>
    </path>
  );
}

function ArrowMarker({ protocol }: { protocol: Protocol }) {
  return (
    <marker
      id={`network-arrow-${protocol.toLowerCase()}`}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth={4.5}
      markerHeight={4.5}
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: PROTOCOL_COLOR[protocol], fillOpacity: 0.85 }} />
    </marker>
  );
}

function Legend() {
  return (
    <div className="flex shrink-0 items-center gap-4 border-b px-1 pb-2 text-[11px]">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: PROTOCOL_COLOR.TCP }} />
        <span className="text-muted-foreground">TCP ↔</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: PROTOCOL_COLOR.UDP }} />
        <span className="text-muted-foreground">UDP → backend</span>
      </span>
    </div>
  );
}

export function NetworkTab({ boards, generalInfo }: { boards: BoardMeta[]; generalInfo: AdjArchiveV2["general_info"] }) {
  const graph = useMemo(() => buildNetworkGraph(boards, generalInfo), [boards, generalInfo]);

  const totalRows = Math.max(graph.boardNodes.length, graph.centralNodes.length, 1);
  const height = PADDING * 2 + totalRows * ROW_H;
  const boardX = PADDING;
  const centralX = DIAGRAM_W - PADDING - NODE_W;

  const positions = new Map<string, { x: number; y: number; side: "left" | "right" }>();
  graph.boardNodes.forEach((node, i) => {
    positions.set(node.id, { x: boardX, y: columnCenterY(i, graph.boardNodes.length, totalRows), side: "left" });
  });
  graph.centralNodes.forEach((node, i) => {
    positions.set(node.id, { x: centralX, y: columnCenterY(i, graph.centralNodes.length, totalRows), side: "right" });
  });

  // Every edge touching a node lands on that node's single connecting edge
  // (boards always face right toward the central column; central nodes always
  // face left toward boards) — fan those points out across the node's height
  // instead of collapsing them all onto its center, which is what made
  // multiple edges overlap into an unreadable smudge.
  const edgesPerNode = new Map<string, string[]>();
  const registerEdge = (nodeId: string, edgeKey: string) => {
    const list = edgesPerNode.get(nodeId) ?? [];
    list.push(edgeKey);
    edgesPerNode.set(nodeId, list);
  };
  for (const edge of graph.edges) {
    registerEdge(edge.from, edge.key);
    registerEdge(edge.to, edge.key);
  }

  const anchor = (nodeId: string, edgeKey: string, facing: "left" | "right") => {
    const pos = positions.get(nodeId);
    if (!pos) return { x: 0, y: 0 };
    const x = facing === "right" ? pos.x + NODE_W : pos.x;
    const siblings = edgesPerNode.get(nodeId) ?? [edgeKey];
    const count = siblings.length;
    if (count <= 1) return { x, y: pos.y };
    const idx = siblings.indexOf(edgeKey);
    const usable = NODE_H - ANCHOR_MARGIN * 2;
    const y = pos.y - usable / 2 + (usable * idx) / (count - 1);
    return { x, y };
  };

  if (graph.boardNodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No boards to show.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <Legend />
      <div className="min-h-0 flex-1 overflow-auto">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${DIAGRAM_W} ${height}`}
          preserveAspectRatio="xMinYMin meet"
          style={{ minWidth: DIAGRAM_W, shapeRendering: "geometricPrecision", textRendering: "optimizeLegibility" }}
        >
          <defs>
            <ArrowMarker protocol="TCP" />
            <ArrowMarker protocol="UDP" />
            <ArrowMarker protocol="OTHER" />
          </defs>

          {graph.edges.map((edge) => {
            // Boards always face right toward the central column, central
            // nodes always face left toward boards — except board-to-board
            // edges (direct socket traffic between two boards), where both
            // ends face right since both nodes sit in the left column.
            const fromFacing = positions.get(edge.from)?.side === "left" ? "right" : "left";
            const toFacing = positions.get(edge.to)?.side === "left" ? "right" : "left";
            const from = anchor(edge.from, edge.key, fromFacing);
            const to = anchor(edge.to, edge.key, toFacing);
            return <EdgePath key={edge.key} edge={edge} from={from} to={to} />;
          })}

          {graph.boardNodes.map((node) => (
            <NodeBox key={node.id} node={node} x={boardX} y={positions.get(node.id)!.y} central={false} />
          ))}
          {graph.centralNodes.map((node) => (
            <NodeBox key={node.id} node={node} x={centralX} y={positions.get(node.id)!.y} central={true} />
          ))}
        </svg>
      </div>
    </div>
  );
}
