import { Separator, SidebarTrigger } from "@workspace/ui";
import { useLocation } from "react-router";
import TabSwitcher from "../components/Header/TabSwitcher";
import { PAGES } from "../constants/pages";

const Header = () => {
  const location = useLocation();
  const pageTitle = PAGES[location.pathname as keyof typeof PAGES].title;
  const isTestingPage = location.pathname === "/";

  return (
    <header className="h-(--header-height) flex shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="text-foreground -ml-1" />
      <Separator
        orientation="vertical"
        className="text-foreground mr-2 data-[orientation=vertical]:h-4"
      />
      <h1 className="text-foreground text-xl font-bold">{pageTitle}</h1>
      {isTestingPage && (
        <div className="ml-auto flex items-center gap-2">
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-4"
          />
          <TabSwitcher />
        </div>
      )}
    </header>
  );
};

export default Header;
