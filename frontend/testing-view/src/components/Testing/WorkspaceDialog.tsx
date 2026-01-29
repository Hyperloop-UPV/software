import { Button } from "@workspace/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/shadcn/dialog";
import { Input } from "@workspace/ui/components/shadcn/input";
import { Label } from "@workspace/ui/components/shadcn/label";
import { Textarea } from "@workspace/ui/components/shadcn/textarea";
import { useEffect, useState } from "react";

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, description: string) => void;
  mode?: "add" | "edit" | null;
  initialName?: string;
  initialDescription?: string;
}

export const WorkspaceDialog = ({
  open,
  onOpenChange,
  onConfirm,
  mode = "add",
  initialName = "",
  initialDescription = "",
}: WorkspaceDialogProps) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  // Update form when initial values change (for edit mode)
  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  const handleConfirm = () => {
    if (!name.trim()) return;

    onConfirm(name.trim(), description.trim());

    // Reset form
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  if (mode === null) return;

  const isAdd = mode === "add";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isAdd ? "Add New Workspace" : "Edit Workspace"}
          </DialogTitle>
          <DialogDescription>
            {isAdd
              ? "Create a new workspace to organize your work. Each workspace has its own filters, charts, and settings."
              : "Update the workspace name and description."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="workspace-name"
              placeholder="e.g., Testing, Analysis, Debug..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleConfirm();
                }
              }}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="workspace-description">Description</Label>
            <Textarea
              id="workspace-description"
              placeholder="Optional description for this workspace..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>
            {isAdd ? "Create Workspace" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
