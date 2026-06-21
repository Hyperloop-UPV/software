import { SidebarMenuButton } from "@workspace/ui/components";
import { SunMoon } from "@workspace/ui/icons";
import { useStore } from "../../store/store";

const ThemeToggleItem = () => {
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const label = isDarkMode ? "Enable Light Mode" : "Enable Dark Mode";

  return (
    <SidebarMenuButton tooltip={label} onClick={toggleDarkMode}>
      <SunMoon className="size-4" />
      <span>{label}</span>
    </SidebarMenuButton>
  );
};

export default ThemeToggleItem;
