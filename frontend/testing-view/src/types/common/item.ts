/**
 * One item of the catalog (commands or telemetry).
 */
export interface Item {
  /** Unique (If firmware fixes it) ID of the item from ADJ */
  id: number;

  /** Name of the item from ADJ */
  name: string;

  /** Label of the item generated from the name on frontend startup */
  label: string;
}
