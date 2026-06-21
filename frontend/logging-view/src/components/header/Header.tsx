import { Separator, SidebarTrigger } from "@workspace/ui/components";


const Header = () => {
  const pageTitle =  "Logging View";

  return (
    <header className="h-(--header-height) flex shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="text-foreground -ml-1" />
      <Separator
        orientation="vertical"
        className="text-foreground mx-1 data-[orientation=vertical]:h-4"
      />
      <h1 className="text-foreground text-xl font-bold">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-2">
            
      </div>
    </header>
  );
};

export default Header;
