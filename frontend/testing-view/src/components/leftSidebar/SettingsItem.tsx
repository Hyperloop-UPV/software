import { SidebarMenuButton } from "@hyperloop-upv/frontend-kit";
import { Settings } from "@hyperloop-upv/frontend-kit/icons";
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
