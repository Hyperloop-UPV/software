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
  Pencil,
  Plus,
  SquareLibrary,
  Trash2,
} from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useState } from "react";
import { useStore } from "../../../store/store";
import type { Workspace } from "../../../types/workspace/workspace";
import { WorkspaceDialog } from "./WorkspaceDialog";

interface WorkspaceSwitcherProps {
  disabled: boolean;
}

const WorkspaceSwitcher = ({ disabled }: WorkspaceSwitcherProps) => {
  const { isMobile } = useSidebar();
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const workspaces = useStore((s) => s.workspaces);
  const addWorkspace = useStore((s) => s.addWorkspace);
  const removeWorkspace = useStore((s) => s.removeWorkspace);
  const updateWorkspace = useStore((s) => s.updateWorkspace);

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "add" | "edit" | null;
    workspace?: Workspace;
  }>({
    open: false,
    mode: null,
    workspace: undefined,
  });

  // Helper functions to open dialog
  const openAddDialog = () => {
    setDialogState({
      open: true,
      mode: "add",
      workspace: undefined,
    });
  };

  const openEditDialog = (workspace: Workspace) => {
    setDialogState({
      open: true,
      mode: "edit",
      workspace,
    });
  };

  const closeDialog = () => {
    setDialogState({
      open: false,
      mode: null,
      workspace: undefined,
    });
  };

  return (
    <>
      {activeWorkspace ? (
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
              <div key={workspace.id} className="group flex items-center gap-1">
                <DropdownMenuItem
                  onClick={() => setActiveWorkspace(workspace)}
                  className="flex-1 gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Folder className="text-foreground size-3.5 shrink-0" />
                  </div>
                  <span className="flex-1">{workspace.name}</span>
                  {/* Action buttons - shown on hover */}
                  <div className="flex items-center gap-0.5 pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="group-hover:text-foreground h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(workspace);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>

                    {/* Delete workspace button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive group-hover:text-destructive h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete workspace "${workspace.name}"?`)) {
                          removeWorkspace(workspace.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>{" "}
                </DropdownMenuItem>
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={openAddDialog}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="text-foreground size-4" />
              </div>
              <div className="text-muted-foreground font-medium">
                Add workspace
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost"
          onClick={openAddDialog}
          className={cn(
            "h-9 gap-2 px-3",
            "hover:bg-accent hover:text-accent-foreground",
          )}
          disabled={disabled}
        >
          <div className="bg-muted text-muted-foreground flex aspect-square size-6 items-center justify-center rounded-md">
            <SquareLibrary className="size-3.5" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="text-muted-foreground truncate font-medium">
              No workspace
            </span>
            <span className="text-muted-foreground truncate text-xs">
              Click to create
            </span>
          </div>
          <Plus className="text-muted-foreground ml-auto size-4" />
        </Button>
      )}

      <WorkspaceDialog
        open={dialogState.open}
        onOpenChange={(open) => !open && closeDialog()}
        onConfirm={(name, description) => {
          if (dialogState.mode === "add") {
            addWorkspace(name, description);
          } else if (dialogState.workspace) {
            updateWorkspace(dialogState.workspace.id, name, description);
          }
        }}
        mode={dialogState.mode}
        initialName={dialogState.workspace?.name}
        initialDescription={dialogState.workspace?.description}
      />
    </>
  );
};

export default WorkspaceSwitcher;
