/**
 * TODO Implement correct packet type from websocket
 */
export interface Packet {
  id: string;
  name: string;
  description: string;
  unit: string;
  timestamp: string;
  value: number | string | boolean;
}
