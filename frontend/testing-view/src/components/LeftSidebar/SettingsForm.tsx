import { Button } from "@workspace/ui/components/shadcn/button";
import { Checkbox } from "@workspace/ui/components/shadcn/checkbox";
import { Input } from "@workspace/ui/components/shadcn/input";
import { Label } from "@workspace/ui/components/shadcn/label";
import { get, set } from "lodash";
import { SETTINGS_SCHEMA } from "../../constants/settingsSchema";
import type { SettingField } from "../../types/common/settings";

interface SettingsConfig {
  [key: string]: SettingField;
}

interface SettingsFormProps {
  config: SettingsConfig;
  onChange: (newConfig: SettingsConfig) => void;
}

export const SettingsForm = ({ config, onChange }: SettingsFormProps) => {
  const handleFieldChange = (path: string, value: any) => {
    const nextConfig = { ...config };
    set(nextConfig, path, value);
    onChange(nextConfig);
  };

  const renderField = (field: SettingField) => {
    const currentValue = get(config, field.path);

    switch (field.type) {
      case "text":
      case "number":
        return (
          <div className="space-y-2" key={field.path}>
            <Label>{field.label}</Label>
            <Input
              type={field.type}
              value={currentValue?.toString() ?? ""}
              placeholder={field.placeholder}
              onChange={(e) =>
                handleFieldChange(
                  field.path,
                  field.type === "number"
                    ? Number(e.target.value)
                    : e.target.value,
                )
              }
            />
          </div>
        );

      case "boolean":
        return (
          <div className="flex items-center space-x-2" key={field.path}>
            <Checkbox
              id={field.path}
              checked={!!currentValue}
              onCheckedChange={(checked) =>
                handleFieldChange(field.path, !!checked)
              }
            />
            <Label htmlFor={field.path}>{field.label}</Label>
          </div>
        );

      case "multi-checkbox":
        return (
          <div className="space-y-3" key={field.path}>
            <Label>{field.label}</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {field.options?.map((opt) => (
                <div key={opt} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.path}-${opt}`}
                    checked={(currentValue as unknown as string[])?.includes(
                      opt,
                    )}
                    onCheckedChange={(checked) => {
                      const currentArr =
                        (currentValue as unknown as string[]) || [];
                      const nextArr = checked
                        ? [...currentArr, opt]
                        : currentArr.filter((i) => i !== opt);
                      handleFieldChange(field.path, nextArr);
                    }}
                  />
                  <Label htmlFor={`${field.path}-${opt}`}>{opt}</Label>
                </div>
              ))}
            </div>
          </div>
        );

      case "path":
        return (
          <div className="space-y-2">
            <Label>{field.label}</Label>
            <div className="flex gap-2">
              <Input value={currentValue?.toString()} readOnly />
              <Button
                variant="outline"
                onClick={async () => {
                  const path = await window.electronAPI?.selectFolder();
                  if (path) handleFieldChange(field.path, path);
                }}
              >
                Browse
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {SETTINGS_SCHEMA.map((section) => (
        <section key={section.title} className="space-y-4">
          <h3 className="text-muted-foreground border-b pb-1 text-sm font-bold uppercase tracking-wider">
            {section.title}
          </h3>
          <div className="grid gap-4">
            {section.fields.map((field) => renderField(field))}
          </div>
        </section>
      ))}
    </div>
  );
};
