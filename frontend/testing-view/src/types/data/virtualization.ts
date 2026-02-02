export type VirtualRow =
  | { type: "board"; id: string; label: string; count: number }
  | { type: "packet"; id: number; data: any }
  | { type: "variable"; id: string; data: any; packetId: number };
