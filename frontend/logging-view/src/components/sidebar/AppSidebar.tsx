import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components";
import Logo from "./Logo";
import ThemeToggleItem from "./ThemeToggleItem";

const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => (
  <Sidebar collapsible="icon" {...props}>
    <SidebarHeader>
      <Logo />
    </SidebarHeader>

    <SidebarContent>

"TEST"

    </SidebarContent>

    <SidebarFooter>

      <div className="my-2" />
      <ThemeToggleItem />
    </SidebarFooter>

    <SidebarRail className="cursor-pointer!" />
  </Sidebar>
);

export default AppSidebar;
