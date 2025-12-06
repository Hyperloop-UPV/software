import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSeparator,
  Button,
  useSidebar,
} from "@workspace/ui";
import {
  ChevronsUpDown,
  SquareLibrary,
  Folder,
  Plus,
} from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useTabStore } from "@workspace/ui/store";

const TabSwitcher = () => {
  const { isMobile } = useSidebar();
  const { activeTab, setActiveTab, tabs } = useTabStore();

  if (!activeTab) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-9 gap-2 px-3",
            "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          )}
        >
          <div className="bg-primary text-primary-foreground flex aspect-square size-6 items-center justify-center rounded-md">
            <SquareLibrary className="size-3.5" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{activeTab.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {activeTab.description}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="end"
        side={isMobile ? "bottom" : "bottom"}
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Tabs
        </DropdownMenuLabel>
        {tabs.map((tab, index) => (
          <DropdownMenuItem
            key={tab.id}
            onClick={() => setActiveTab(tab)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-md border">
              <Folder className="size-3.5 shrink-0" />
            </div>
            {tab.name}
            <DropdownMenuShortcut>⌘ {index + 1}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
            <Plus className="size-4" />
          </div>
          <div className="text-muted-foreground font-medium">Add tab</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TabSwitcher;
