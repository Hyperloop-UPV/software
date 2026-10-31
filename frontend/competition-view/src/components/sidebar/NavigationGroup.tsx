import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@hyperloop-upv/frontend-kit/components";
import { type LucideIcon } from "@hyperloop-upv/frontend-kit/icons";
import { Link, useLocation } from "react-router";

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
}

interface NavigationGroupProps {
  items: NavItem[];
}

const NavigationGroup = ({ items }: NavigationGroupProps) => {
  const location = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pages</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              tooltip={item.title}
              isActive={location.pathname === item.url}
              asChild
            >
              <Link to={item.url}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};

export default NavigationGroup;
