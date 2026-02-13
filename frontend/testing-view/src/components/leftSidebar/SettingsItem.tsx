import { SidebarMenuButton } from "@workspace/ui";
import { Settings } from "@workspace/ui/icons";
import { useStore } from "../../store/store";

const SettingsItem = () => {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  return (
    <SidebarMenuButton tooltip="Settings" onClick={() => setSettingsOpen(true)}>
      <Settings />
      <span>Settings</span>
    </SidebarMenuButton>
  );
};

export default SettingsItem;
