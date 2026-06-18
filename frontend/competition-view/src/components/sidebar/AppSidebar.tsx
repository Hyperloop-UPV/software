import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components";
import { PAGES_ARRAY } from "../../constants/pages";
import ConnectionStatusGroup from "./ConnectionStatusGroup";
import Logo from "./Logo";
import NavigationGroup from "./NavigationGroup";
import ThemeToggleItem from "./ThemeToggleItem";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  backendConnected: boolean;
}

const AppSidebar = ({ backendConnected, ...props }: AppSidebarProps) => (
  <Sidebar collapsible="icon" {...props}>
    <SidebarHeader>
      <Logo />
    </SidebarHeader>

    <SidebarContent>
      <NavigationGroup items={PAGES_ARRAY} />
    </SidebarContent>

    <SidebarFooter>
      <ConnectionStatusGroup backendConnected={backendConnected} />
      <div className="my-2" />
      <ThemeToggleItem />
    </SidebarFooter>

    <SidebarRail className="cursor-pointer!" />
  </Sidebar>
);

export default AppSidebar;
