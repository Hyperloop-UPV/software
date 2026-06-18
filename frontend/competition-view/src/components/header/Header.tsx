import { Button, Separator, SidebarTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components";
import { Keyboard } from "@workspace/ui/icons";
import { useLocation } from "react-router";
import { PAGES } from "../../constants/pages";
import ConnectionBadge from "./ConnectionBadge";

interface HeaderProps {
  backendConnected: boolean;
  onShowShortcuts: () => void;
}

const Header = ({ backendConnected, onShowShortcuts }: HeaderProps) => {
  const location = useLocation();
  const page = PAGES[location.pathname as keyof typeof PAGES];
  const pageTitle = page?.title ?? "Competition View";

  return (
    <header className="h-(--header-height) flex shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="text-foreground -ml-1" />
      <Separator
        orientation="vertical"
        className="text-foreground mx-1 data-[orientation=vertical]:h-4"
      />
      <h1 className="text-foreground text-xl font-bold">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowShortcuts}
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
        </Tooltip>

        <ConnectionBadge connected={backendConnected} />
      </div>
    </header>
  );
};

export default Header;
