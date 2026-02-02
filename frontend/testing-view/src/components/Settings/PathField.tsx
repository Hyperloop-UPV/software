import { Button, Input, Label } from "@workspace/ui";
import type { FieldProps } from "../../types/common/settings";

export const PathField = ({ field, value, onChange }: FieldProps<string>) => {
  const handleBrowse = async () => {
    // Accessing the Electron API exposed via preload script
    const path = await window.electronAPI?.selectFolder();
    if (path) {
      onChange(path);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{field.label}</Label>
      <div className="flex gap-2">
        <Input
          value={value?.toString() ?? ""}
          readOnly
          placeholder={field.placeholder || "No path selected"}
          className="bg-muted/50"
        />
        <Button variant="outline" type="button" onClick={handleBrowse}>
          Browse
        </Button>
      </div>
    </div>
  );
};
