export interface Message {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "success" | "error";
  message: string;
  details: string;
}
