import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui";
import { Plug, Unplug } from "@workspace/ui/icons";
import type { Connection } from "../../types/Connection";

interface ConnectionStatusGroupProps {
  connections: Connection[];
}

const ConnectionStatusGroup = ({ connections }: ConnectionStatusGroupProps) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Connections</SidebarGroupLabel>
      <SidebarMenu>
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
