import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@workspace/ui/components";
import NavigationGroup from "../components/LeftSidebar/NavigationGroup";
import ConnectionStatusGroup from "../components/LeftSidebar/ConnectionStatusGroup";
import SettingsItem from "../components/LeftSidebar/SettingsItem";
import ThemeToggleItem from "../components/LeftSidebar/ThemeToggleItem";
import { MOCK_CONNECTIONS } from "../mocks/connections";
import { PAGES_ARRAY } from "../constants/pages";
import ColorSchemeToggle from "../components/LeftSidebar/ColorSchemeToggle";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  backendConnected: boolean;
}

const AppSidebar = ({ backendConnected, ...props }: AppSidebarProps) => {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavigationGroup items={PAGES_ARRAY} />
        <ConnectionStatusGroup
          connections={MOCK_CONNECTIONS}
          backendConnected={backendConnected}
        />
      </SidebarContent>
      <SidebarFooter>
        <ColorSchemeToggle />
        <ThemeToggleItem />
        <SettingsItem />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
