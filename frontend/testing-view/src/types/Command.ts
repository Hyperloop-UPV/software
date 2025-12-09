// Command Types
export interface Command {
  id: string;
  name: string;
  description: string;
  parameters?: {
    name: string;
    type: "string" | "number" | "boolean";
    required: boolean;
    default?: string | number | boolean;
  }[];
  dangerous?: boolean;
}
