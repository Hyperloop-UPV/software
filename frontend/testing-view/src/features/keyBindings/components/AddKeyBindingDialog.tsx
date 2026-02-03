import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import { X } from "@workspace/ui/icons";
import { useEffect, useRef, useState } from "react";
import { SPECIAL_KEY_BINDINGS } from "../../../constants/specialKeyBindings";
import { getDefaultParameterValues } from "../../../lib/commandUtils";
import { useStore } from "../../../store/store";
import type { CommandCatalogItem } from "../../../types/data/commandCatalogItem";
import { CommandParameters } from "../../workspace/components/rightSidebar/tabs/commands/CommandParameters";

interface AddKeyBindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddKeyBindingDialog = ({
  open,
  onOpenChange,
}: AddKeyBindingDialogProps) => {
  const [selectedCommandId, setSelectedCommandId] = useState<number | null>(
    null,
  );
  const [capturedKey, setCapturedKey] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>(
    {},
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const commandsCatalog = useStore((s) => s.commandsCatalog);
  const addKeyBinding = useStore((s) => s.addKeyBinding);

  // Get selected command details
  const selectedCommand = selectedCommandId
    ? (Object.values(commandsCatalog)
        .flat()
        .find((c) => c.id === selectedCommandId) as
        | CommandCatalogItem
        | undefined)
    : null;

  const hasParameters = selectedCommand
    ? Object.keys(selectedCommand.fields).length > 0
    : false;

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedCommandId(null);
      setCapturedKey("");
      setIsCapturing(false);
      setParameterValues({});
    }
  }, [open]);

  // Initialize parameter defaults when command is selected
  useEffect(() => {
    if (selectedCommand) {
      const defaults: Record<string, any> = getDefaultParameterValues(
        selectedCommand.fields,
      );
      setParameterValues(defaults);
    }
  }, [selectedCommand]);

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
      return;
    }

    let key: string;
    if (SPECIAL_KEY_BINDINGS[e.key]) {
      key = SPECIAL_KEY_BINDINGS[e.key];
    } else if (e.key.length === 1) {
      key = e.key.toUpperCase();
    } else {
      key = e.key;
    }

    setCapturedKey(key);
    setIsCapturing(false);
  };

  const handleAddBinding = () => {
    if (selectedCommandId !== null && capturedKey) {
      addKeyBinding(selectedCommandId, capturedKey, parameterValues);
      onOpenChange(false);
    }
  };

  const handleClearKey = () => {
    setCapturedKey("");
    setIsCapturing(false);
  };

  const handleParameterChange = (fieldId: string, value: any) => {
    setParameterValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const canSubmit = selectedCommandId !== null && capturedKey !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full min-w-[500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Key Binding</DialogTitle>
          <DialogDescription>
            Select a command, assign a key, and configure parameters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Command Selection */}
          <div className="space-y-2">
            <Label>Command</Label>
            <Select
              value={selectedCommandId?.toString() || ""}
              onValueChange={(value) => setSelectedCommandId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select command..." />
              </SelectTrigger>
              <SelectContent className="px-2 py-2">
                {Object.entries(commandsCatalog).map(
                  ([boardName, commands]) => (
                    <SelectGroup key={boardName}>
                      {commands.length > 0 && (
                        <SelectLabel>{boardName}</SelectLabel>
                      )}
                      {commands.map((command) => (
                        <SelectItem
                          key={command.id}
                          value={command.id.toString()}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{command.label}</span>
                            <span className="text-muted-foreground text-xs">
                              ID: {command.id} • {boardName}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Parameters Section */}
          {hasParameters && selectedCommand && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Parameters</Label>
                <span className="text-muted-foreground text-xs">
                  {Object.keys(selectedCommand.fields).length} parameter(s)
                </span>
              </div>
              <div className="space-y-3">
                <CommandParameters
                  fields={selectedCommand.fields}
                  values={parameterValues}
                  onChange={handleParameterChange}
                />
              </div>
            </div>
          )}

          {/* Key Capture */}
          <div className="space-y-2">
            <Label>Key</Label>
            <div className="relative">
              <Input
                ref={inputRef}
                value={capturedKey}
                placeholder={
                  isCapturing ? "Press any key..." : "Click to capture key"
                }
                readOnly
                onFocus={() => setIsCapturing(true)}
                onBlur={() => setIsCapturing(false)}
                onKeyDown={handleKeyCapture}
                className="pr-8 font-mono"
              />
              {capturedKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearKey}
                  className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBinding} disabled={!canSubmit}>
              Add Binding
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
