import type { Item } from "./Item";

export interface CommandParameter {
  kind: string;
  id: string;
  name: string;
  type: string;
}

interface NumericCommandParameter extends CommandParameter {
  safeRange: (number | null)[];
  warningRange: (number | null)[];
}

interface EnumCommandParameter extends CommandParameter {
  options: string[];
}

export interface CommandParameters {
  [key: string]: NumericCommandParameter | EnumCommandParameter;
}

interface RawOrder extends Item {
  fields: CommandParameters;
}

export type Command = RawOrder;
