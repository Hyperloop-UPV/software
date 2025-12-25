import type { Item } from "./Item";

export interface Variable {
  id: string;
  name: string;
  type: string;
  units: string;
}

export type Measurement = any;

export type Packet = RawPacket;

export interface RawPacket extends Item {
  hexValue: string;
  count: number;
  cycleTime: number;
  type: string;
  measurements: Measurement[];
}
