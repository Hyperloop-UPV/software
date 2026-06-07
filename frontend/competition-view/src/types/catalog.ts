/**
 * Type definitions for the orders/commands catalog fetched from the backend
 * endpoint `GET /backend/orderStructures`.
 */

export type CommandParameterKind = "numeric" | "enum" | "boolean";

interface BaseParameter {
  kind: CommandParameterKind;
  id: string;
  name: string;
  type: string;
}

export interface NumericParameter extends BaseParameter {
  kind: "numeric";
  safeRange: (number | null)[];
  warningRange: (number | null)[];
}

export interface EnumParameter extends BaseParameter {
  kind: "enum";
  options: string[];
}

export interface BooleanParameter extends BaseParameter {
  kind: "boolean";
}

export type CommandParameter = NumericParameter | EnumParameter | BooleanParameter;

export interface CommandCatalogItem {
  id: number;
  label: string;
  fields: Record<string, CommandParameter>;
}

export interface BoardOrdersData {
  name: string;
  orders: CommandCatalogItem[];
}

export interface OrdersData {
  boards: BoardOrdersData[];
}

/** Values held by the parameter form for a single command. */
export type ParameterValues = Record<string, string | number | boolean>;
