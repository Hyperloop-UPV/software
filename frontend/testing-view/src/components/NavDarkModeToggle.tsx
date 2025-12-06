import { SidebarMenuButton, SidebarMenuItem } from "@workspace/ui";
import { useDarkMode } from "@workspace/ui/hooks";
import { Moon, Sun, SunMoon } from "@workspace/ui/icons";
import React from "react";

const NavDarkModeToggle = () => {
  const { toggleDarkMode, isDarkMode } = useDarkMode();

  const tooltip = isDarkMode ? "Enable Light Mode" : "Enable Dark Mode";

  return (
    <SidebarMenuButton tooltip={tooltip} onClick={toggleDarkMode}>
      <SunMoon className="size-4" />
      <span>{tooltip}</span>
    </SidebarMenuButton>
  );
};

export default NavDarkModeToggle;
