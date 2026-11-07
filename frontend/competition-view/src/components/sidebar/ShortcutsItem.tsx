import { SidebarMenuButton } from "@hyperloopupv/frontend-kit/components";
import { Keyboard } from "@hyperloopupv/frontend-kit/icons";

interface ShortcutsItemProps {
  onShowShortcuts: () => void;
}

/** Sidebar footer item that opens the keyboard shortcuts reference dialog. */
const ShortcutsItem = ({ onShowShortcuts }: ShortcutsItemProps) => (
  <SidebarMenuButton tooltip="Keyboard shortcuts (?)" onClick={onShowShortcuts}>
    <Keyboard className="size-4" />
    <span>Keyboard Shortcuts</span>
  </SidebarMenuButton>
);

export default ShortcutsItem;
