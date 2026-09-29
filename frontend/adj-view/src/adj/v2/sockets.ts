export type Protocol = "TCP" | "UDP" | "OTHER";

// Socket "type" comes straight from the ADJ archive (Java-style class names:
// ServerSocket = TCP, DatagramSocket = UDP) — derive protocol from it rather
// than hardcoding specific socket names.
export function protocolFromSocketType(type: string): Protocol {
  const t = type.toLowerCase();
  if (t.includes("datagram")) return "UDP";
  if (t.includes("server") || t.includes("stream") || t.includes("tcp")) return "TCP";
  return "OTHER";
}
