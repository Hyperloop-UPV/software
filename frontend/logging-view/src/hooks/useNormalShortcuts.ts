import { useEffect, useRef } from "react";
import { shortcutForKey, type ShortcutId } from "../lib/normal/shortcuts";

export type ShortcutHandlers = Record<ShortcutId, () => void>;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// A dialog, menu or picker owns the keyboard while it is open.
const OVERLAYS = '[role="dialog"], [role="menu"], [role="listbox"]';

const ARROW_WIDGETS =
  '[role="tablist"], [role="separator"], [role="slider"], [role="radiogroup"]';

/** Id of the plot the pointer is over, if any. */
export function hoveredPaneId(): string | null {
  const hovered = document.querySelectorAll(":hover");
  const deepest = hovered[hovered.length - 1];
  return (
    deepest?.closest<HTMLElement>("[data-pane-id]")?.dataset.paneId ?? null
  );
}

export function useNormalShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTyping(event.target) || document.querySelector(OVERLAYS)) return;
      const id = shortcutForKey(event);
      if (!id) return;
      // Tabs, resize handles and sliders move with the arrow keys themselves.
      if (
        event.key.startsWith("Arrow") &&
        event.target instanceof Element &&
        event.target.closest(ARROW_WIDGETS)
      )
        return;
      event.preventDefault();
      handlersRef.current[id]();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
