import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui";
import { Plug, Unplug } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
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
              className={cn(
                connection.isConnected
                  ? "text-green-600 hover:bg-green-600/10 hover:text-green-600"
                  : "text-red-600 hover:bg-red-600/10 hover:text-red-600",
              )}
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
