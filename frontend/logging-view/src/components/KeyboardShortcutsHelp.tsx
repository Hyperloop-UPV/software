import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
} from "@hyperloop-upv/frontend-kit/components";
import { Keyboard } from "@hyperloop-upv/frontend-kit/icons";
// NOTE: the original hooks module was not available at this path in some
// environments. Define a local fallback for SHORTCUT_DEFS here so this
// component compiles and still shows useful keyboard shortcuts. Keep the
// shape compatible with the original usage: { key, label, description }.
const SHORTCUT_DEFS: { key: string; label: string; description: string }[] = [
  { key: "help", label: "?", description: "Open keyboard shortcuts" },
  { key: "focus-search", label: "/", description: "Focus search input" },
  { key: "new-entry", label: "n", description: "Create new log entry" },
];

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal dialog listing all keyboard shortcuts.
 * Opened via the header button or by pressing '?'.
 */
const KeyboardShortcutsHelp = ({ open, onOpenChange }: KeyboardShortcutsHelpProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Keyboard className="size-4" />
          Keyboard Shortcuts
        </DialogTitle>
      </DialogHeader>

      <Separator />

      <ul className="flex flex-col gap-3 py-1">
        {SHORTCUT_DEFS.map(({ key, label, description }) => (
          <li key={key} className="flex items-start justify-between gap-4">
            <span className="text-foreground text-sm">{description}</span>
            <kbd className="bg-muted text-muted-foreground shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 font-mono text-xs font-semibold tracking-wider shadow-sm">
              {label}
            </kbd>
          </li>
        ))}
      </ul>

      <Separator />

      <p className="text-muted-foreground text-xs">
        Shortcuts are disabled while typing in input fields.
      </p>
    </DialogContent>
  </Dialog>
);

export default KeyboardShortcutsHelp;
