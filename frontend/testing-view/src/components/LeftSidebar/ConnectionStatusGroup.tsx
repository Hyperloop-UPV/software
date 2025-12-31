import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui";
import { Plug, Unplug } from "@workspace/ui/icons";
import { useStore } from "../../store/store";

interface ConnectionStatusGroupProps {
  backendConnected: boolean;
}

const ConnectionStatusGroup = ({
  backendConnected,
}: ConnectionStatusGroupProps) => {
  const connections = useStore((s) => s.connections);

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
