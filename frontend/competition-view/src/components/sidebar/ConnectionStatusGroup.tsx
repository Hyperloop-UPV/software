import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components";
import { Plug, Unplug } from "@workspace/ui/icons";
import useConnections from "../../hooks/useConnections";

interface ConnectionStatusGroupProps {
  backendConnected: boolean;
}

const ConnectionStatusGroup = ({
  backendConnected,
}: ConnectionStatusGroupProps) => {
  const connections = useConnections();

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>Connections</SidebarGroupLabel>
      <SidebarMenu>
        {/* Backend WebSocket connection */}
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

        {/* Per-board connections reported by the backend */}
        {Object.values(connections).map((connection) => (
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
