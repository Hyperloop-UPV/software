// Bandwidth estimate per board, derived from the ADJ v2 packet definitions plus
// the backend's TCP keep-alive.
//
// UDP wire format (backend: pkg/transport/presentation/decoder.go and
// pkg/transport/packet/data/codec.go): each UDP datagram carries exactly one
// packet = uint16 packet ID + the packet's variables in order, packed with no
// padding. Enums are sent as their uint8 variant index, bools as 1 byte.
//
// TCP keep-alive (backend: pkg/transport/keepalive.go): an empty packet with
// id 1 (just the 2-byte ID) sent to every connected board every
// tcp.keep_alive_interval_ms, and the boards send the same packet back. The
// connection has TCP_NODELAY set, so each keep-alive is its own segment.
import type { BoardMeta } from "./AdjViewerTabs";
import { protocolFromSocketType } from "./sockets";

export const PACKET_ID_BYTES = 2;
export const KEEP_ALIVE_ID = 1;

const TYPE_BYTES: Record<string, number> = {
  uint8: 1,
  int8: 1,
  bool: 1,
  uint16: 2,
  int16: 2,
  uint32: 4,
  int32: 4,
  float32: 4,
  uint64: 8,
  int64: 8,
  float64: 8,
};

function measurementBytes(type: string): number | undefined {
  // Backend accepts any type starting with "enum" as an enum measurement.
  if (type.startsWith("enum")) return 1;
  return TYPE_BYTES[type];
}

export const PERIOD_UNIT_SECONDS: Record<string, number> = {
  ns: 1e-9,
  us: 1e-6,
  ms: 1e-3,
  s: 1,
};

export const PERIOD_UNITS = Object.keys(PERIOD_UNIT_SECONDS);

// Per-segment overhead, assuming IPv4 and TCP without options over Ethernet II
// without a VLAN tag. Ethernet pads its payload up to 46 bytes, so small
// segments cost more than their size suggests; preamble/SFD and the
// inter-frame gap occupy the link too, so they count toward bandwidth use.
export type Transport = "UDP" | "TCP";
export const TRANSPORT_HEADER_BYTES: Record<Transport, number> = { UDP: 8, TCP: 20 };
export const IPV4_HEADER_BYTES = 20;
export const ETH_MIN_PAYLOAD_BYTES = 46;
// Largest IP packet in one Ethernet frame; bigger datagrams would fragment,
// which this model does not simulate.
export const ETH_MTU_BYTES = 1500;
export const ETH_HEADER_BYTES = 14;
export const ETH_FCS_BYTES = 4;
export const ETH_PREAMBLE_SFD_BYTES = 8;
export const ETH_INTERFRAME_GAP_BYTES = 12;

// Which assumptions the estimate includes; all on is the worst case.
export interface TrafficOptions {
  udp: boolean;
  keepAlive: boolean;
  // Every keep-alive acknowledged by its own pure-ACK segment instead of
  // piggybacking on the other side's keep-alive.
  acks: boolean;
  // Preamble/SFD and inter-frame gap (physical-layer occupancy).
  l1Overhead: boolean;
}

export const DEFAULT_TRAFFIC_OPTIONS: TrafficOptions = { udp: true, keepAlive: true, acks: true, l1Overhead: true };

export interface WireBreakdown {
  transport: Transport;
  transportHeader: number;
  payload: number;
  ipPacket: number;
  padding: number;
  frame: number;
  preambleSfd: number;
  interFrameGap: number;
  total: number;
}

export function wireBreakdown(payloadBytes: number, transport: Transport, l1Overhead: boolean): WireBreakdown {
  const transportHeader = TRANSPORT_HEADER_BYTES[transport];
  const ipPacket = payloadBytes + transportHeader + IPV4_HEADER_BYTES;
  const padding = Math.max(0, ETH_MIN_PAYLOAD_BYTES - ipPacket);
  const frame = ETH_HEADER_BYTES + ipPacket + padding + ETH_FCS_BYTES;
  const preambleSfd = l1Overhead ? ETH_PREAMBLE_SFD_BYTES : 0;
  const interFrameGap = l1Overhead ? ETH_INTERFRAME_GAP_BYTES : 0;
  return {
    transport,
    transportHeader,
    payload: payloadBytes,
    ipPacket,
    padding,
    frame,
    preambleSfd,
    interFrameGap,
    total: preambleSfd + frame + interFrameGap,
  };
}

export interface PacketField {
  id: string;
  type: string;
  bytes: number;
}

// "up" = board → backend, "down" = backend → board.
export type Direction = "up" | "down";

// One periodic stream of identical frames: a UDP data packet, a TCP keep-alive
// or the ACKs it triggers.
export interface TrafficFlow {
  key: string;
  name: string;
  id?: number;
  transport: Transport;
  direction: Direction;
  period: number;
  periodUnit: string;
  // The ADJ's own period and unit when period/periodUnit are a what-if
  // override; undefined otherwise.
  adjPeriod?: number;
  adjPeriodUnit?: string;
  periodSeconds: number;
  rateHz: number;
  hasPacketId: boolean;
  fields: PacketField[];
  payloadBytes: number;
  wire: WireBreakdown;
  wireBytes: number;
  payloadBps: number;
  wireBps: number;
}

function makeFlow(
  base: Pick<
    TrafficFlow,
    "key" | "name" | "id" | "transport" | "direction" | "period" | "periodUnit" | "adjPeriod" | "adjPeriodUnit" | "hasPacketId" | "fields"
  >,
  periodSeconds: number,
  l1Overhead: boolean,
): TrafficFlow {
  const payloadBytes = (base.hasPacketId ? PACKET_ID_BYTES : 0) + base.fields.reduce((s, f) => s + f.bytes, 0);
  const rateHz = 1 / periodSeconds;
  const wire = wireBreakdown(payloadBytes, base.transport, l1Overhead);
  return {
    ...base,
    periodSeconds,
    rateHz,
    payloadBytes,
    wire,
    wireBytes: wire.total,
    payloadBps: payloadBytes * 8 * rateHz,
    wireBps: wire.total * 8 * rateHz,
  };
}

// A UDP packet whose throughput can't be computed from its definition.
export interface SkippedPacket {
  id: number;
  name: string;
  reason: string;
}

export interface BoardThroughput {
  board: string;
  hasTcp: boolean;
  packets: TrafficFlow[];
  skipped: SkippedPacket[];
  payloadBps: number;
  wireBps: number;
}

// What-if periods by packet id. They only feed the calculation; the ADJ itself
// is never modified.
export interface PeriodOverride {
  value: number;
  unit: string;
}
export type PeriodOverrides = ReadonlyMap<number, PeriodOverride>;

export function periodSeconds(value: number, unit: string): number | undefined {
  const s = PERIOD_UNIT_SECONDS[unit];
  return s === undefined ? undefined : value * s;
}

export function computeBoardThroughput(
  board: BoardMeta,
  l1Overhead: boolean,
  periodOverrides?: PeriodOverrides,
): BoardThroughput {
  const udpSockets = new Set(
    board.sockets.filter((s) => protocolFromSocketType(s.type) === "UDP").map((s) => s.name),
  );
  const typeById = new Map(board.measurements.map((m) => [m.id, m.type]));

  const packets: TrafficFlow[] = [];
  const skipped: SkippedPacket[] = [];

  for (const p of board.packets) {
    if (!p.socket || !udpSockets.has(p.socket)) continue;
    const skip = (reason: string) => skipped.push({ id: p.id, name: p.name, reason });

    const override = periodOverrides?.get(p.id);
    const period = override?.value ?? p.period;
    const unit = override?.unit ?? p.period_type ?? "";
    if (period == null || period <= 0) {
      skip("no period");
      continue;
    }
    const seconds = periodSeconds(period, unit);
    if (seconds === undefined) {
      skip(`unknown period unit "${unit}"`);
      continue;
    }

    const fields: PacketField[] = [];
    const problems: string[] = [];
    for (const v of p.variables ?? []) {
      const type = typeById.get(v);
      const size = type === undefined ? undefined : measurementBytes(type);
      if (type === undefined) problems.push(`unknown variable "${v}"`);
      else if (size === undefined) problems.push(`unknown type "${type}" for "${v}"`);
      else fields.push({ id: v, type, bytes: size });
    }
    if (problems.length > 0) {
      skip(problems.join(", "));
      continue;
    }

    packets.push(
      makeFlow(
        {
          key: `udp-${p.id}`,
          name: p.name,
          id: p.id,
          transport: "UDP",
          direction: "up",
          period,
          periodUnit: unit,
          adjPeriod: override !== undefined ? p.period : undefined,
          adjPeriodUnit: override !== undefined ? (p.period_type ?? "") : undefined,
          hasPacketId: true,
          fields,
        },
        seconds,
        l1Overhead,
      ),
    );
  }

  return {
    board: board.name,
    hasTcp: board.sockets.some((s) => protocolFromSocketType(s.type) === "TCP"),
    packets,
    skipped,
    payloadBps: packets.reduce((s, p) => s + p.payloadBps, 0),
    wireBps: packets.reduce((s, p) => s + p.wireBps, 0),
  };
}

export interface KeepAliveIntervals {
  backendMs: number;
  boardMs: number;
}

// Per connected board. An interval that isn't > 0 disables that side's
// keep-alive and its ACKs.
export function keepAliveFlows(
  { backendMs, boardMs }: KeepAliveIntervals,
  { acks, l1Overhead }: Pick<TrafficOptions, "acks" | "l1Overhead">,
): TrafficFlow[] {
  const flows: TrafficFlow[] = [];
  const add = (key: string, name: string, direction: Direction, ms: number, hasPacketId: boolean) =>
    flows.push(
      makeFlow(
        {
          key,
          name,
          id: hasPacketId ? KEEP_ALIVE_ID : undefined,
          transport: "TCP",
          direction,
          period: ms,
          periodUnit: "ms",
          hasPacketId,
          fields: [],
        },
        ms * 1e-3,
        l1Overhead,
      ),
    );

  if (boardMs > 0) {
    add("ka-board", "Board keep-alive", "up", boardMs, true);
    if (acks) add("ack-board", "ACK of board keep-alive", "down", boardMs, false);
  }
  if (backendMs > 0) {
    add("ka-backend", "Backend keep-alive", "down", backendMs, true);
    if (acks) add("ack-backend", "ACK of backend keep-alive", "up", backendMs, false);
  }
  return flows;
}

export function sumBps(flows: TrafficFlow[], direction: Direction): number {
  return flows.filter((f) => f.direction === direction).reduce((s, f) => s + f.wireBps, 0);
}

export interface BoardTotals {
  udp: number;
  keepAliveUp: number;
  keepAliveDown: number;
  up: number;
  down: number;
}

// kaFlows must already be empty when keep-alive is excluded.
export function boardTotals(
  board: BoardThroughput,
  connected: boolean,
  kaFlows: TrafficFlow[],
  includeUdp: boolean,
): BoardTotals {
  const udp = includeUdp ? board.wireBps : 0;
  const keepAliveUp = connected ? sumBps(kaFlows, "up") : 0;
  const keepAliveDown = connected ? sumBps(kaFlows, "down") : 0;
  return { udp, keepAliveUp, keepAliveDown, up: udp + keepAliveUp, down: keepAliveDown };
}

export function formatBitrate(bps: number): string {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbit/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} kbit/s`;
  return `${bps.toFixed(0)} bit/s`;
}
