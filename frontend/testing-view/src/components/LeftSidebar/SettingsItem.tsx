import { SidebarMenuButton } from "@workspace/ui";
import { Settings } from "@workspace/ui/icons";

const SettingsItem = () => {
  return (
    <SidebarMenuButton tooltip="Settings">
      <Settings />
      <span>Settings</span>
    </SidebarMenuButton>
  );
};

export default SettingsItem;
