import {
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import type {
  CommandParameter,
  EnumCommandParameter,
  NumericCommandParameter,
} from "../../../../../../types/data/commandCatalogItem";

interface CommandParametersProps {
  fields: Record<string, CommandParameter>;
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
}

export const CommandParameters = ({
  fields,
  values,
  onChange,
}: CommandParametersProps) => {
  const renderParameterInput = (field: CommandParameter) => {
    if (field.kind === "numeric") {
      const numField = field as NumericCommandParameter;
      const minSafeRange = numField.safeRange[0];
      const maxSafeRange = numField.safeRange[1];
      const minWarningRange = numField.warningRange[0];
      const maxWarningRange = numField.warningRange[1];

      return (
        <div key={field.id} className="w-full space-y-1.5">
          <Label
            htmlFor={field.id}
            className="text-muted-foreground text-xs font-medium"
          >
            {field.name} (default: 0)
          </Label>
          <Input
            id={field.id}
            type="number"
            placeholder={field.type}
            value={values[field.id] ?? ""}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="h-8 text-xs"
          />
          {minSafeRange !== null && maxSafeRange !== null && (
            <p className="text-muted-foreground text-[10px]">
              Range: {minSafeRange} to {maxSafeRange}
            </p>
          )}
          {minWarningRange !== null && maxWarningRange !== null && (
            <p className="text-muted-foreground text-[10px]">
              Warning range: {minWarningRange} to {maxWarningRange}
            </p>
          )}
        </div>
      );
    }

    if (field.kind === "enum") {
      const enumField = field as EnumCommandParameter;
      return (
        <div key={field.id} className="w-full space-y-1.5">
          <Label
            htmlFor={field.id}
            className="text-muted-foreground text-xs font-medium"
          >
            {field.name}
          </Label>
          <Select
            value={values[field.id] ?? ""}
            onValueChange={(value) => onChange(field.id, value)}
          >
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {enumField.options.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  className="py-1 text-xs"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.kind === "boolean") {
      return (
        <div
          key={field.id}
          className="flex w-full items-center justify-between rounded-md border p-2"
        >
          <Label
            htmlFor={field.id}
            className="text-foreground cursor-pointer text-xs font-medium"
          >
            {field.name}
          </Label>
          <Checkbox
            id={field.id}
            checked={values[field.id] || false}
            onCheckedChange={(checked) => onChange(field.id, checked)}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {Object.values(fields).map((field: CommandParameter) =>
        renderParameterInput(field),
      )}
    </>
  );
};
