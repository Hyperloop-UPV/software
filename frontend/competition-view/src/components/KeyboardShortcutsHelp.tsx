import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
} from "@workspace/ui/components";
import { Keyboard } from "@workspace/ui/icons";
import { SHORTCUT_DEFS } from "../hooks/useKeyboardShortcuts";

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
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Keyboard className="size-4" />
          Keyboard Shortcuts
        </DialogTitle>
      </DialogHeader>

      <Separator />

      <ul className="flex flex-col gap-3 py-1">
        {SHORTCUT_DEFS.map(({ key, label, description }) => (
          <li key={key} className="flex items-center justify-between gap-4">
            <span className="text-foreground text-sm">{description}</span>
            <kbd className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 font-mono text-xs font-semibold tracking-wider shadow-sm">
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
