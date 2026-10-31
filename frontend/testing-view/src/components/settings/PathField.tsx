import { Button, Input, Label } from "@hyperloop-upv/frontend-kit";
import { FolderOpen } from "@hyperloop-upv/frontend-kit/icons";
import { logger } from "@hyperloop-upv/frontend-kit/core";
import { useOpenFolder } from "../../hooks/useOpenFolder";
import type { FieldProps } from "../../types/common/settings";

export const PathField = ({ field, value, onChange }: FieldProps<string>) => {
  const { openFolder } = useOpenFolder();

  const handleBrowse = async () => {
    if (!window.electronAPI) {
      logger.testingView.warn("electronAPI is not available");
      return;
    }
    const path = await window.electronAPI.selectFolder();
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
        <Button variant="outline" size="icon" type="button" onClick={() => openFolder(value?.toString())} title="Open folder">
          <FolderOpen size={16} />
        </Button>
        <Button variant="outline" type="button" onClick={handleBrowse}>
          Browse
        </Button>
      </div>
    </div>
  );
};
