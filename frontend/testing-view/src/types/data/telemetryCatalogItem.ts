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
 * Definition of a TelemetryPacket as it arrives from the backend.
 */
export interface RawPacket extends Item {
  hexValue: string;
  count: number;
  cycleTime: number;
  type: string;
  measurements: Variable[];
}

/**
 * Definition of a telemetry catalog item as it arrives from the backend and my label.
 */
export type TelemetryCatalogItem = CatalogItem & RawPacket;
