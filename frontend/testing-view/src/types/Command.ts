import type { Item } from "./Item";

// Command Types
export interface Command extends Item {
  description: string;
  parameters?: {
    name: string;
    type: "string" | "number" | "boolean";
    required: boolean;
    default?: string | number | boolean;
  }[];
  dangerous?: boolean;
}
