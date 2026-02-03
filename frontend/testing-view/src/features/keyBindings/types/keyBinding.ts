/**
 * Key binding definition.
 */
export interface KeyBinding {
  /** UUID for this binding */
  id: string;
  /** The command's ID */
  commandId: number;
  /** The key (e.g., "1", "a") */
  key: string;
  /** The parameters for this binding executed with the command */
  parameters: Record<string, any>;
}
