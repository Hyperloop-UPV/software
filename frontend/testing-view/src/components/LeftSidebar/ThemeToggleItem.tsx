import { SidebarMenuButton } from "@workspace/ui";
import { SunMoon } from "@workspace/ui/icons";
import { useDarkModeStore } from "@workspace/ui/store";

const ThemeToggleItem = () => {
  const toggleDarkMode = useDarkModeStore((s) => s.toggleDarkMode);
  const isDarkMode = useDarkModeStore((s) => s.isDarkMode);

  const tooltip = isDarkMode ? "Enable Light Mode" : "Enable Dark Mode";

  return (
    <SidebarMenuButton tooltip={tooltip} onClick={toggleDarkMode}>
      <SunMoon className="size-4" />
      <span>{tooltip}</span>
    </SidebarMenuButton>
  );
};

export default ThemeToggleItem;
