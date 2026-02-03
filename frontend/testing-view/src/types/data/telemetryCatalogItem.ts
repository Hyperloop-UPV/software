import type { CatalogItem, Item } from "../common/item";

/**
 * Variable definition. Sometimes also called Measurement. This is the same thing.
 */
export interface Variable {
  id: string;
  name: string;
  type: string;
  units: string;
}

/**
 * Definition of a telemetry packet as it arrives from the backend.
 */
export interface RawPacket extends Item {
  count: number;
  cycleTime: number;
  type: string;
  measurements: Variable[];
  /** Currently unused (always equals to "000000" placeholder) */
  hexValue: string;
}

/**
 * Definition of a telemetry catalog item as it arrives from the backend and my label.
 */
export type TelemetryCatalogItem = CatalogItem & RawPacket;
