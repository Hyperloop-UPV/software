import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components";
import { Plug, Unplug } from "@workspace/ui/icons";

interface ConnectionStatusGroupProps {
  backendConnected: boolean;
}

const ConnectionStatusGroup = ({
  backendConnected,
}: ConnectionStatusGroupProps) => (
  <SidebarGroup className="p-0">
    <SidebarGroupLabel>Connections</SidebarGroupLabel>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Backend"
          className={
            backendConnected ? "text-(--success)" : "text-(--error)"
          }
        >
          {backendConnected ? <Plug /> : <Unplug />}
          Backend
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
);

export default ConnectionStatusGroup;
