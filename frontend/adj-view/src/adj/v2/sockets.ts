// Socket helpers shared by the Network, Sockets and Throughput tabs. This is the
// only place that interprets an AdjSocket (protocol, role, which port is the
// board's, where remote_ip points), so all tabs agree.
import type { AdjSocket } from "./types";

export type Protocol = "TCP" | "UDP" | "OTHER";

export type SocketRole = "TCP server" | "TCP client" | "UDP" | "Unknown";

// Socket "type" comes straight from the ADJ archive (Java-style class names:
// ServerSocket = TCP server, Socket = TCP client, DatagramSocket = UDP) — derive
// protocol from it rather than hardcoding specific socket names.
export function protocolFromSocketType(type: string): Protocol {
  const t = type.toLowerCase();
  if (t.includes("datagram") || t.includes("udp")) return "UDP";
  if (t.includes("socket") || t.includes("stream") || t.includes("tcp")) return "TCP";
  return "OTHER";
}

export function socketRole(type: string): SocketRole {
  const protocol = protocolFromSocketType(type);
  if (protocol === "UDP") return "UDP";
  if (protocol === "OTHER") return "Unknown";
  return type.toLowerCase().includes("server") ? "TCP server" : "TCP client";
}

// The port on the board's side: `port` for ServerSocket/DatagramSocket,
// `local_port` for a TCP client Socket.
export function boardPort(socket: AdjSocket): number | undefined {
  return socket.port ?? socket.local_port;
}

export interface SocketTarget {
  kind: "board" | "address" | "ip";
  // Stable id: board name, address key, or `ip:<ip>` for an unknown IP.
  id: string;
  label: string;
  ip: string;
}

// A socket's remote_ip may be a symbolic key into `addresses` (e.g. "backend"),
// the raw IP of a known address, another board's IP (board-to-board traffic),
// or an IP the archive doesn't know about.
export function resolveTarget(
  remoteIp: string,
  addresses: Record<string, string>,
  boardByIp?: ReadonlyMap<string, string>,
): SocketTarget {
  const board = boardByIp?.get(remoteIp);
  if (board) return { kind: "board", id: board, label: board, ip: remoteIp };
  if (remoteIp in addresses) {
    return { kind: "address", id: remoteIp, label: remoteIp, ip: addresses[remoteIp] };
  }
  const knownKey = Object.entries(addresses).find(([, ip]) => ip === remoteIp)?.[0];
  if (knownKey) return { kind: "address", id: knownKey, label: knownKey, ip: remoteIp };
  return { kind: "ip", id: `ip:${remoteIp}`, label: remoteIp, ip: remoteIp };
}

// Names from general_info.ports that use this port number (usually one).
export function portNames(port: number | undefined, ports: Record<string, number>): string[] {
  if (port == null) return [];
  return Object.entries(ports)
    .filter(([, p]) => p === port)
    .map(([name]) => name);
}
