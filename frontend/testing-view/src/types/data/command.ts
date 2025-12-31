import type { Item } from "../common/item";

export interface CommandParameter {
  kind: string;
  id: string;
  name: string;
  type: string;
}

export interface NumericCommandParameter extends CommandParameter {
  safeRange: (number | null)[];
  warningRange: (number | null)[];
}

export interface EnumCommandParameter extends CommandParameter {
  options: string[];
}

export interface CommandParameters {
  [key: string]: NumericCommandParameter | EnumCommandParameter;
}

export interface RawOrder extends Item {
  fields: CommandParameters;
}

export type Command = RawOrder;
