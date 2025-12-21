import {
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@workspace/ui/components";
import NavigationGroup from "./NavigationGroup";
import ConnectionStatusGroup from "./ConnectionStatusGroup";
import SettingsItem from "./SettingsItem";
import ThemeToggleItem from "./ThemeToggleItem";
import { MOCK_CONNECTIONS } from "../../mocks/connections";
import { PAGES_ARRAY } from "../../constants/pages";
import ColorSchemeToggle from "./ColorSchemeToggle";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  backendConnected: boolean;
}

const AppSidebar = ({ backendConnected, ...props }: AppSidebarProps) => {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavigationGroup items={PAGES_ARRAY} />
      </SidebarContent>
      <SidebarFooter>
        <ConnectionStatusGroup
          connections={MOCK_CONNECTIONS}
          backendConnected={backendConnected}
        />
        <div className="my-2" />
        <ColorSchemeToggle />
        <ThemeToggleItem />
        <SettingsItem />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
