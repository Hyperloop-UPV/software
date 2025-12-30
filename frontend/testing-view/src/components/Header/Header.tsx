import { Separator, SidebarTrigger } from "@workspace/ui";
import { useLocation } from "react-router";
import TabSwitcher from "./TabSwitcher";
import { ModeBadge } from "./ModeBadge";
import { PAGES } from "../../constants/pages";
import { ReconnectButton } from "./ReconnectButton";
import { useStore } from "../../store/store";

const Header = () => {
  const location = useLocation();
  const pageTitle = PAGES[location.pathname as keyof typeof PAGES].title;
  const isTestingPage = location.pathname === "/";
  const appMode = useStore((s) => s.appMode);

  return (
    <header className="h-(--header-height) flex shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="text-foreground -ml-1" />
      <Separator
        orientation="vertical"
        className="text-foreground mx-1 data-[orientation=vertical]:h-4"
      />
      <ModeBadge />
      <ReconnectButton />
      <Separator
        orientation="vertical"
        className="text-foreground mx-1 data-[orientation=vertical]:h-4"
      />
      <h1 className="text-foreground text-xl font-bold">{pageTitle}</h1>
      <div className="ml-auto flex items-center gap-2">
        {isTestingPage && (
          <>
            <Separator
              orientation="vertical"
              className="data-[orientation=vertical]:h-4"
            />
            <TabSwitcher
              disabled={appMode === "loading" || appMode === "error"}
            />
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
