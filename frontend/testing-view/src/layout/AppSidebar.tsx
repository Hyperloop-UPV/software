import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenuButton,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components";
import { FlaskConical, ScrollText, Camera } from "@workspace/ui/icons";
import NavMain from "../components/NavMain";
import NavConnections from "../components/NavConnections";
import NavSettings from "../components/NavSettings";
import NavDarkModeToggle from "../components/NavDarkModeToggle";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {}

const data = {
  navMain: [
    { title: "Testing", icon: FlaskConical, url: "/", isActive: true },
    { title: "Logs", icon: ScrollText, url: "/logs" },
    { title: "Camera View", icon: Camera, url: "/camera-view" },
  ],
  navConnections: [
    { name: "Backend", isConnected: true },
    { name: "VLCU", isConnected: false },
    { name: "BLU", isConnected: true },
  ],
};

const AppSidebar = ({ ...props }: AppSidebarProps) => {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavConnections connections={data.navConnections} />
      </SidebarContent>
      <SidebarFooter>
        <NavDarkModeToggle />
        <NavSettings />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
