import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useSidebar,
} from "@workspace/ui";
import {
  ChevronsUpDown,
  Folder,
  Plus,
  SquareLibrary,
} from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useStore } from "../../store/store";

interface TabSwitcherProps {
  disabled: boolean;
}

const TabSwitcher = ({ disabled }: TabSwitcherProps) => {
  const { isMobile } = useSidebar();
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const workspaces = useStore((s) => s.workspaces);

  if (!activeWorkspace) {
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
          disabled={disabled}
        >
          <div className="bg-primary text-primary-foreground flex aspect-square size-6 items-center justify-center rounded-md">
            <SquareLibrary className="text-primary-foreground size-3.5" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="text-foreground truncate font-medium">
              {activeWorkspace.name}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {activeWorkspace.description}
            </span>
          </div>
          <ChevronsUpDown className="text-foreground ml-auto size-4" />
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
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setActiveWorkspace(workspace)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-md border">
              <Folder className="text-foreground size-3.5 shrink-0" />
            </div>
            {workspace.name}
            {/* <DropdownMenuShortcut>⌘ {index + 1}</DropdownMenuShortcut> */}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
            <Plus className="text-foreground size-4" />
          </div>
          <div className="text-muted-foreground font-medium">Add workspace</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TabSwitcher;
