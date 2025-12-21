import { SidebarMenuButton } from "@workspace/ui";
import { Palette } from "@workspace/ui/icons";
import { useStore } from "../../store/store";

const ColorSchemeToggle = () => {
  const colorScheme = useStore((s) => s.colorScheme);
  const toggleColorScheme = useStore((s) => s.toggleColorScheme);

  const isPink = colorScheme === "pink";
  const tooltip = isPink ? "Switch to Default" : "Switch to Firmware";

  return (
    <SidebarMenuButton tooltip={tooltip} onClick={toggleColorScheme}>
      <Palette className="size-4" />
      <span>{isPink ? "Firmware" : "Default"}</span>
      <div className="bg-primary ml-auto h-4 w-4 rounded-full" />
    </SidebarMenuButton>
  );
};

export default ColorSchemeToggle;
