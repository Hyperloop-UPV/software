import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Plus } from "@workspace/ui/icons";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../../../store/store";
import type { KeyBinding } from "../types/keyBinding";
import { AddKeyBindingDialog } from "./AddKeyBindingDialog";
import { KeyBindingCard } from "./KeyBindingCard";
import { OrphanedKeyBindingCard } from "./OrphanedKeyBindingCard";

interface KeyBindingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeyBindingsDialog = ({
  open,
  onOpenChange,
}: KeyBindingsDialogProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const keyBindings: KeyBinding[] = useStore(
    useShallow((s) => s.getKeyBindings()),
  );
  const commandsCatalog = useStore((s) => s.commandsCatalog);
  const activeWorkspace = useStore((s) => s.activeWorkspace);

  // Get command details for display
  const getCommandDetails = (commandId: number) => {
    for (const [boardName, commands] of Object.entries(commandsCatalog)) {
      const command = commands.find((c) => c.id === commandId);
      if (command) {
        return { command, boardName };
      }
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full min-w-[700px]">
          <DialogHeader>
            <DialogTitle>Key Bindings - {activeWorkspace?.name}</DialogTitle>
            <DialogDescription>
              Press keys to quickly execute commands without clicking
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {keyBindings.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
                <p className="mb-2 text-sm">No key bindings yet</p>
              </div>
            ) : (
              <div className="max-h-[400px] space-y-2 overflow-y-auto">
                {keyBindings.map((binding) => {
                  const details = getCommandDetails(binding.commandId);
                  if (!details)
                    return <OrphanedKeyBindingCard binding={binding} />;

                  return (
                    <KeyBindingCard
                      key={binding.id}
                      binding={binding}
                      commandLabel={details.command.label}
                      commandId={details.command.id}
                      boardName={details.boardName}
                    />
                  );
                })}
              </div>
            )}

            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="w-full gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Add Key Binding
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddKeyBindingDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </>
  );
};
