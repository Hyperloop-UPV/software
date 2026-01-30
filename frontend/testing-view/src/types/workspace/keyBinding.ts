export interface KeyBinding {
  id: string; // UUID for this binding
  commandId: number; // The command's ID
  key: string; // The key (e.g., "1", "a")
  parameters: Record<string, any>;
}
