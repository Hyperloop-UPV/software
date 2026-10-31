import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@hyperloop-upv/frontend-kit/components";
import { PAGES_ARRAY } from "../../constants/pages";
import AboutItem from "./AboutItem";
import ConnectionStatusGroup from "./ConnectionStatusGroup";
import LoggerItem from "./LoggerItem";
import Logo from "./Logo";
import NavigationGroup from "./NavigationGroup";
import ShortcutsItem from "./ShortcutsItem";
import ThemeToggleItem from "./ThemeToggleItem";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  backendConnected: boolean;
  onShowShortcuts: () => void;
}

const AppSidebar = ({ backendConnected, onShowShortcuts, ...props }: AppSidebarProps) => (
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
      <LoggerItem disabled={!backendConnected} />
      <ThemeToggleItem />
      <ShortcutsItem onShowShortcuts={onShowShortcuts} />
      <AboutItem />
    </SidebarFooter>

    <SidebarRail className="cursor-pointer!" />
  </Sidebar>
);

export default AppSidebar;
