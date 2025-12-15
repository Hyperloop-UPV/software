import type { Item } from "./Item";

export interface Variable {
  id: string;
  name: string;
  type: string;
  unit: string;
  value: number | string | boolean;
}

/**
 * TODO Implement correct packet type from websocket
 */
export interface Packet extends Item {
  description: string;
  timestamp: string;
  variables: Variable[];
}
