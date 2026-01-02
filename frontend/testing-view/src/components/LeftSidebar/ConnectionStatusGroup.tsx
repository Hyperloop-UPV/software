import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui";
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
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Backend"
            className={backendConnected ? "text-(--success)" : "text-(--error)"}
          >
            {backendConnected ? <Plug /> : <Unplug />}
            Backend
          </SidebarMenuButton>
        </SidebarMenuItem>
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
