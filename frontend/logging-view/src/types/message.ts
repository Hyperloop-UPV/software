export type MessageKind = "info" | "warning" | "error" | "debug";

export interface Message {
  id: string;
  content: string;
  kind: MessageKind;
  timestamp: number;
}

/** Raw packet shape sent by the backend over the WebSocket. */
export interface MessagePacket {
  content: string;
  kind: MessageKind;
  timestamp: number;
}
