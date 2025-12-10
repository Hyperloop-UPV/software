import type { Item } from "./Item";

/**
 * TODO Implement correct packet type from websocket
 */
export interface Packet extends Item {
  description: string;
  unit: string;
  timestamp: string;
  value: number | string | boolean;
}
