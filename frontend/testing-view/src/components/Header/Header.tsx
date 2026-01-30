import { Separator, SidebarTrigger } from "@workspace/ui";
import { useLocation } from "react-router";
import { PAGES } from "../../constants/pages";
import { useStore } from "../../store/store";
import { KeyBindingsButton } from "../Testing/KeyBindings/KeyBindingsButton";
import { LoggerControl } from "../Testing/LoggerControl";
import WorkspaceSwitcher from "../Testing/WorkspaceSwitcher";
import { ModeBadge } from "./ModeBadge";
import { ReconnectButton } from "./ReconnectButton";

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
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-4"
        />
        <LoggerControl
          disabled={appMode === "loading" || appMode === "error"}
        />
        {isTestingPage && (
          <>
            <Separator
              orientation="vertical"
              className="data-[orientation=vertical]:h-4"
            />
            <KeyBindingsButton
              disabled={appMode === "loading" || appMode === "error"}
            />
            <Separator
              orientation="vertical"
              className="data-[orientation=vertical]:h-4"
            />
            <WorkspaceSwitcher
              disabled={appMode === "loading" || appMode === "error"}
            />
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
