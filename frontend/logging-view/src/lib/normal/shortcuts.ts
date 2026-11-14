// The single list of Normal mode shortcuts: the key handler and the help
// dialog both read it, so the dialog cannot drift from what the keys do.

export type ShortcutId =
  | "zoomIn"
  | "zoomOut"
  | "panLeft"
  | "panRight"
  | "resetZoom"
  | "newPlot"
  | "newFormula"
  | "statistics"
  | "cursors"
  | "orders"
  | "linkTime"
  | "expand"
  | "fitY"
  | "previousEvent"
  | "nextEvent"
  | "escape"
  | "help";

export interface ShortcutDefinition {
  id: ShortcutId;
  /** `KeyboardEvent.key` values, lower-cased, that trigger it. */
  keys: string[];
  /** How the keys are shown to the user. */
  label: string;
  description: string;
  group: "Time" | "Plots" | "Panels" | "General";
}

export const NORMAL_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "zoomIn",
    keys: ["+", "="],
    label: "+",
    description: "Zoom in",
    group: "Time",
  },
  {
    id: "zoomOut",
    keys: ["-", "_"],
    label: "−",
    description: "Zoom out",
    group: "Time",
  },
  {
    id: "panLeft",
    keys: ["arrowleft"],
    label: "←",
    description: "Move the window back",
    group: "Time",
  },
  {
    id: "panRight",
    keys: ["arrowright"],
    label: "→",
    description: "Move the window forward",
    group: "Time",
  },
  {
    id: "resetZoom",
    keys: ["0"],
    label: "0",
    description: "Reset zoom",
    group: "Time",
  },
  {
    id: "previousEvent",
    keys: [","],
    label: ",",
    description: "Cursor A to the previous order or marker",
    group: "Time",
  },
  {
    id: "nextEvent",
    keys: ["."],
    label: ".",
    description: "Cursor A to the next order or marker",
    group: "Time",
  },
  {
    id: "linkTime",
    keys: ["l"],
    label: "L",
    description: "Link or unlink the time axis of the plots",
    group: "Time",
  },
  {
    id: "newPlot",
    keys: ["n"],
    label: "N",
    description: "New plot",
    group: "Plots",
  },
  {
    id: "newFormula",
    keys: ["m"],
    label: "M",
    description: "New formula",
    group: "Plots",
  },
  {
    id: "expand",
    keys: ["f"],
    label: "F",
    description: "Expand or restore the plot under the pointer",
    group: "Plots",
  },
  {
    id: "fitY",
    keys: ["y"],
    label: "Y",
    description: "Fit the Y axis of the plot under the pointer to its window",
    group: "Plots",
  },
  {
    id: "statistics",
    keys: ["s"],
    label: "S",
    description: "Window statistics",
    group: "Panels",
  },
  {
    id: "cursors",
    keys: ["c"],
    label: "C",
    description: "Measuring cursors",
    group: "Panels",
  },
  {
    id: "orders",
    keys: ["o"],
    label: "O",
    description: "Order markers",
    group: "Panels",
  },
  {
    id: "escape",
    keys: ["escape"],
    label: "Esc",
    description: "Restore the expanded plot, or clear the cursors",
    group: "General",
  },
  {
    id: "help",
    keys: ["?"],
    label: "?",
    description: "Show this list",
    group: "General",
  },
];

/** Mouse gestures, listed in the same dialog for reference only. */
export const NORMAL_GESTURES: { label: string; description: string }[] = [
  { label: "Scroll", description: "Zoom in time" },
  { label: "Drag · Shift+scroll", description: "Pan in time" },
  { label: "Ctrl+drag", description: "Zoom to the selected stretch" },
  {
    label: "Click · Shift+click",
    description: "Place cursor A · B (with cursors on)",
  },
  { label: "Double click", description: "Add a marker" },
];

export function shortcutForKey(event: KeyboardEvent): ShortcutId | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.toLowerCase();
  return (
    NORMAL_SHORTCUTS.find((shortcut) => shortcut.keys.includes(key))?.id ?? null
  );
}
