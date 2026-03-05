import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuButton,
} from "@workspace/ui";
import { Eye, EyeOff } from "@workspace/ui/icons";
import { useStore } from "../../store/store";

const DevToolsItem = () => {
  const toggleDevToolsVisible = useStore((s) => s.toggleDevToolsVisible);
  const isVisible = useStore((s) => s.isDevToolsVisible);

  const isDev = import.meta.env.DEV || import.meta.env.VITE_FORCE_DEV;

  if (!isDev) return null;

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>Dev mode</SidebarGroupLabel>
      <SidebarMenuButton
        tooltip="Toggle mode switcher"
        onClick={() => toggleDevToolsVisible()}
      >
        {isVisible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
        <span>Toggle mode switcher</span>
      </SidebarMenuButton>
    </SidebarGroup>
  );
};

export default DevToolsItem;
