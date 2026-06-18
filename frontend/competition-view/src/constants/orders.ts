/**
 * Hardcoded order IDs used during competition.
 * Each ID maps to a backend command understood by the VCU/HV system.
 */

export interface OrderFieldValue {
  value: unknown;
  isEnabled: boolean;
  type: string;
}

export interface Order {
  id: number;
  fields: Record<string, OrderFieldValue>;
}

/** Engages the brakes. */
export const BRAKE_ORDERS: Order[] = [
  { id: 215, fields: {} },
];

/** Opens the HV contactors to cut power. */
export const OPEN_CONTACTORS_ORDERS: Order[] = [
  { id: 902, fields: {} },
];

/**
 * Full emergency stop sequence:
 * triggers emergency brake + disables propulsion + cuts HV power.
 */
export const EMERGENCY_STOP_ORDERS: Order[] = [
  { id: 55,   fields: {} },
  { id: 1799, fields: {} },
  { id: 1698, fields: {} },
  { id: 0,    fields: {} },
];
