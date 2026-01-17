export interface MessageTimestamp {
  counter: number;
  second: number;
  minute: number;
  hour: number;
  day: number;
  month: number;
  year: number;
}

export interface MessagePacket {
  kind: "info" | "warning" | "fault" | "ok";
  payload: any;
  board: string;
  name: string;
  timestamp: MessageTimestamp;
}

export interface Message extends MessagePacket {
  id: string; // Generated on frontend for React keys
}
