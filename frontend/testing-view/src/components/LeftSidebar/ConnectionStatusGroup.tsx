import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui";
import { Plug, Unplug } from "@workspace/ui/icons";
import type { Connection } from "../../types/Connection";
import { useStore } from "../../store/store";

interface ConnectionStatusGroupProps {
  connections: Connection[];
  backendConnected: boolean;
}

const ConnectionStatusGroup = ({
  connections,
  backendConnected,
}: ConnectionStatusGroupProps) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Connections</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Backend"
            className={backendConnected ? "text-(--success)" : "text-(--error)"}
          >
            {backendConnected ? <Plug /> : <Unplug />}
            Backend
          </SidebarMenuButton>
        </SidebarMenuItem>
        {connections.map((connection) => (
          <SidebarMenuItem key={connection.name}>
            <SidebarMenuButton
              tooltip={connection.name}
              className={
                connection.isConnected ? "text-(--success)" : "text-(--error)"
              }
            >
              {connection.isConnected ? <Plug /> : <Unplug />}
              {connection.name}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};

export default ConnectionStatusGroup;
