import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@hyperloopupv/frontend-kit/components";
import { Keyboard } from "@hyperloopupv/frontend-kit/icons";
import { NORMAL_GESTURES, NORMAL_SHORTCUTS } from "../lib/normal/shortcuts";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GROUPS = ["Time", "Plots", "Panels", "General"] as const;

const Key = ({ children }: { children: string }) => (
  <kbd className="bg-muted text-muted-foreground shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap shadow-sm">
    {children}
  </kbd>
);

/** Lists the Normal mode shortcuts. Opened with `?` or the footer button. */
const KeyboardShortcutsHelp = ({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[40rem]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Keyboard className="size-4" />
          Keyboard shortcuts
        </DialogTitle>
        <DialogDescription>
          Disabled while typing in a field or while a menu or dialog is open.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group} aria-label={`${group} shortcuts`}>
            <h3 className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
              {group}
            </h3>
            <ul className="grid gap-1.5">
              {NORMAL_SHORTCUTS.filter(
                (shortcut) => shortcut.group === group,
              ).map(({ id, label, description }) => (
                <li
                  key={id}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span>{description}</span>
                  <Key>{label}</Key>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section aria-label="Mouse gestures" className="sm:col-span-2">
          <h3 className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
            Mouse
          </h3>
          <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {NORMAL_GESTURES.map(({ label, description }) => (
              <li
                key={label}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <span>{description}</span>
                <Key>{label}</Key>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DialogContent>
  </Dialog>
);

export default KeyboardShortcutsHelp;
