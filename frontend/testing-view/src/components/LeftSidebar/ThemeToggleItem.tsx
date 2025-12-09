import { SidebarMenuButton } from "@workspace/ui";
import { useDarkMode } from "@workspace/ui/hooks";
import { SunMoon } from "@workspace/ui/icons";

const ThemeToggleItem = () => {
  const { toggleDarkMode, isDarkMode } = useDarkMode();

  const tooltip = isDarkMode ? "Enable Light Mode" : "Enable Dark Mode";

  return (
    <SidebarMenuButton tooltip={tooltip} onClick={toggleDarkMode}>
      <SunMoon className="size-4" />
      <span>{tooltip}</span>
    </SidebarMenuButton>
  );
};

export default ThemeToggleItem;
