import type { KeyBinding } from "./keyBinding";

export interface Workspace {
  name: string;
  id: string;
  description: string;
  keyBindings: KeyBinding[];
}
