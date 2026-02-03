/**
 * Raw item from the catalog (commands or telemetry) as it arrives from the backend.
 */
export interface Item {
  /** Unique (If firmware fixes it) ID of the item from ADJ */
  id: number;

  /** Name of the item from ADJ */
  name: string;
}

/**
 * Item from the catalog (commands or telemetry) with my label.
 */
export interface CatalogItem extends Item {
  /** Label of the item generated from the name on frontend startup */
  label: string;
}
