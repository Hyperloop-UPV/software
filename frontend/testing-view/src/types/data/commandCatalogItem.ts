import type { CatalogItem, Item } from "../common/item";

/**
 * Params of a command.
 */
export type CommandParameter = {
  kind: string;
  id: string;
  name: string;
  type: string;
};

/**
 * Numeric parameter has safe and warning ranges.
 */
export type NumericCommandParameter = CommandParameter & {
  safeRange: (number | null)[];
  warningRange: (number | null)[];
};

/**
 * Enum parameter has options.
 */
export type EnumCommandParameter = CommandParameter & {
  options: string[];
};

/**
 * Map of parameter id to parameter type of a command.\
 * Each parameter can be either numeric or enum.
 */
export type CommandParameters = {
  [key: string]: NumericCommandParameter | EnumCommandParameter;
};

/**
 * Definition of a command packet as it arrives from the backend.
 */
export type RawOrder = Item & {
  fields: CommandParameters;
};

/**
 * Definition of a command catalog item as it arrives from the backend and my label.
 */
export type CommandCatalogItem = CatalogItem & RawOrder;
