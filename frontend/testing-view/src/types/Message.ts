/**
 * TODO Implement correct message type from websocket
 */
export interface Message {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  details?: string;
}
