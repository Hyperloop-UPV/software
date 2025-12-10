import { SidebarMenuButton } from "@workspace/ui";
import { useColorScheme } from "../../hooks/useColorScheme";
import { Palette } from "@workspace/ui/icons";

const ColorSchemeToggle = () => {
  const { colorScheme, setColorScheme } = useColorScheme();

  const isPink = colorScheme === "pink";
  const tooltip = isPink ? "Switch to Default" : "Switch to Firmware";

  const toggleColorScheme = () => {
    setColorScheme(isPink ? "default" : "pink");
  };

  return (
    <SidebarMenuButton tooltip={tooltip} onClick={toggleColorScheme}>
      <Palette className="size-4" />
      <span>{isPink ? "Firmware" : "Default"}</span>
      <div className="bg-primary ml-auto h-4 w-4 rounded-full" />
    </SidebarMenuButton>
  );
};

export default ColorSchemeToggle;
