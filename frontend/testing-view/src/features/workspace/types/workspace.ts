import type { KeyBinding } from "../../keyBindings/types/keyBinding";

/**
 * Workspace definition.
 */
export interface Workspace {
  /** The name of the workspace */
  name: string;
  /** The id of the workspace */
  id: string;
  /** The description of the workspace */
  description: string;
  /** The key bindings for the workspace */
  keyBindings: KeyBinding[];
}
