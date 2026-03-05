import { get, set } from "lodash";
import { useMemo } from "react";
import { getSettingsSchema } from "../../constants/settingsSchema";
import { useStore } from "../../store/store";
import type { ConfigData } from "../../types/common/config";
import type { SettingField } from "../../types/common/settings";
import { BooleanField } from "./BooleanField";
import { MultiCheckboxField } from "./MultiCheckboxField";
import { PathField } from "./PathField";
import { SelectField } from "./SelectField";
import { TextField } from "./TextField";

interface SettingsFormProps {
  config: ConfigData;
  onChange: (newConfig: ConfigData) => void;
}

export const SettingsForm = ({ config, onChange }: SettingsFormProps) => {
  const handleFieldChange = (
    path: string,
    value: string | number | boolean | string[],
  ) => {
    const nextConfig = { ...config };
    set(nextConfig, path, value);
    onChange(nextConfig);
  };

  const boards = useStore((s) => s.boards);
  const schema = useMemo(() => getSettingsSchema(boards), [boards]);

  const renderField = (field: SettingField) => {
    const currentValue = get(config, field.path);

    switch (field.type) {
      case "text":
        return (
          <TextField
            key={field.path}
            field={field}
            value={currentValue as unknown as string}
            onChange={(value) => handleFieldChange(field.path, value)}
          />
        );

      case "number":
        return (
          <TextField
            key={field.path}
            field={field}
            value={currentValue as unknown as string}
            onChange={(value) => handleFieldChange(field.path, Number(value))}
          />
        );

      case "boolean":
        return (
          <BooleanField
            key={field.path}
            field={field}
            value={currentValue as unknown as boolean}
            onChange={(value) => handleFieldChange(field.path, value)}
          />
        );

      case "multi-checkbox":
        return (
          <MultiCheckboxField
            key={field.path}
            field={field}
            value={currentValue as unknown as string[]}
            onChange={(value) => handleFieldChange(field.path, value)}
          />
        );

      case "path":
        return (
          <PathField
            key={field.path}
            field={field}
            value={currentValue as unknown as string}
            onChange={(value) => handleFieldChange(field.path, value)}
          />
        );

      case "select":
        return (
          <SelectField
            key={field.path}
            field={field}
            value={currentValue as unknown as string}
            onChange={(value) => handleFieldChange(field.path, value)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {schema.map((section) => (
        <section key={section.title} className="space-y-4">
          <h3 className="text-muted-foreground border-b pb-1 text-sm font-bold tracking-wider uppercase">
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
