import { useCallback, useEffect, useRef, useState } from "react";

/** Returns true when focus is inside a text-input element. */
const isTypingInInput = () => {
  const tag = document.activeElement?.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
};

export interface ShortcutDef {
  key: string;
  /** Human-readable label shown in the help dialog. */
  label: string;
  description: string;
}

/** All available shortcuts, in display order. */
export const SHORTCUT_DEFS: ShortcutDef[] = [
  { key: "b",     label: "B",       description: "Brake"                              },
  { key: "o",     label: "O",       description: "Open Contactors"                    },
  { key: "e",     label: "E → E",   description: "Emergency Stop (press twice in 2 s)" },
  { key: "shift+/", label: "?",     description: "Toggle keyboard shortcuts reference" },
];

interface Options {
  /** Whether shortcuts are active (disable when modal is open, etc.). */
  enabled: boolean;
  onBrake: () => void;
  onOpenContactors: () => void;
  onEmergencyStop: () => void;
  onToggleHelp: () => void;
}

interface Result {
  /** True for up to 2 s after the first E press — use to show an armed indicator. */
  estopArmed: boolean;
}

/**
 * Registers global keydown handlers for competition quick-actions.
 *
 * Shortcuts fire only when the user is NOT typing in a form field.
 * ESTOP requires two E presses within 2 seconds to prevent accidents.
 */
const useKeyboardShortcuts = ({
  enabled,
  onBrake,
  onOpenContactors,
  onEmergencyStop,
  onToggleHelp,
}: Options): Result => {
  const [estopArmed, setEstopArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armEstop = useCallback(() => {
    setEstopArmed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setEstopArmed(false), 2000);
  }, []);

  const confirmEstop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setEstopArmed(false);
    onEmergencyStop();
  }, [onEmergencyStop]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || isTypingInInput()) return;
      // Ignore anything with Ctrl/Meta/Alt to avoid clashing with OS shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          onBrake();
          break;

        case "o":
          e.preventDefault();
          onOpenContactors();
          break;

        case "e":
          e.preventDefault();
          if (estopArmed) {
            confirmEstop();
          } else {
            armEstop();
          }
          break;

        case "?":
          e.preventDefault();
          onToggleHelp();
          break;
      }
    },
    [enabled, estopArmed, onBrake, onOpenContactors, armEstop, confirmEstop, onToggleHelp],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Clean up the arm timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { estopArmed };
};

export default useKeyboardShortcuts;
