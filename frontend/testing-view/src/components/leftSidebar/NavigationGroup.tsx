import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@hyperloop-upv/frontend-kit/components";
import { type LucideIcon } from "@hyperloop-upv/frontend-kit/icons";
import { Link } from "react-router";

interface NavigationGroupProps {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
}

const NavigationGroup = ({ items }: NavigationGroupProps) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pages</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton tooltip={item.title} asChild>
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
