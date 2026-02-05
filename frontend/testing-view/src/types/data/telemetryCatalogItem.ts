import type { CatalogItem, Item } from "../common/item";

/**
 * Variable definition. Sometimes also called Measurement. This is the same thing.
 */
export type Variable = {
  id: string;
  name: string;
  type: string;
  units?: string;
};

export interface NumericVariable extends Variable {
  safeRange: (number | null)[];
  warningRange: (number | null)[];
}

export interface EnumVariable extends Variable {
  options: string[];
}

type BooleanVariable = Variable;

export type TelemetryVariable =
  | NumericVariable
  | EnumVariable
  | BooleanVariable;

/**
 * Definition of a telemetry packet as it arrives from the backend.
 */
export type RawPacket = Item & {
  count: number;
  cycleTime: number;
  type: string;
  measurements: TelemetryVariable[];
  /** Currently unused (always equals to "000000" placeholder on the backend) */
  hexValue: string;
};

/**
 * Definition of a telemetry catalog item as it arrives from the backend and my label.
 */
export type TelemetryCatalogItem = CatalogItem & RawPacket;
