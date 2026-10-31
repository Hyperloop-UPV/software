import { SidebarMenuButton } from "@hyperloop-upv/frontend-kit";
import { Palette } from "@hyperloop-upv/frontend-kit/icons";
import { useStore } from "../../store/store";
import { colorSchemes } from "../../types/app/colorSchema";

const ColorSchemeToggle = () => {
  const colorScheme = useStore((s) => s.colorScheme);
  const toggleColorScheme = useStore((s) => s.toggleColorScheme);

  const scheme = colorSchemes[colorScheme];
  const tooltip = `Switch to ${colorSchemes[scheme.next].label}`;

  return (
    <SidebarMenuButton
      tooltip={tooltip}
      aria-label={`${scheme.label} theme. ${tooltip}`}
      onClick={toggleColorScheme}
    >
      <Palette className="size-4" />
      <span>{scheme.label}</span>
      <div className="bg-primary ml-auto h-3 w-3 rounded-full" />
    </SidebarMenuButton>
  );
};

export default ColorSchemeToggle;
