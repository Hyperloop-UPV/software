import type { Item } from "../common/item";

export interface Variable {
  id: string;
  name: string;
  type: string;
  units: string;
}

export type Measurement = any;

export interface RawPacket extends Item {
  hexValue: string;
  count: number;
  cycleTime: number;
  type: string;
  measurements: Measurement[];
}

export type Packet = RawPacket;
