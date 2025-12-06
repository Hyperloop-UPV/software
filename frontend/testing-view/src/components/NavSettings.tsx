import { SidebarMenuButton } from "@workspace/ui";
import { Settings } from "@workspace/ui/icons";
import React from "react";

const NavSettings = () => {
  return (
    <SidebarMenuButton tooltip="Settings">
      <Settings />
      <span>Settings</span>
    </SidebarMenuButton>
  );
};

export default NavSettings;
