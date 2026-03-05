import { Checkbox } from "@workspace/ui/components/shadcn/checkbox";
import { Label } from "@workspace/ui/components/shadcn/label";
import type { FieldProps } from "../../types/common/settings";

export const MultiCheckboxField = ({
  field,
  value,
  onChange,
}: FieldProps<string[]>) => {
  const currentArr = (value as string[]) || [];

  const handleToggle = (opt: string, checked: boolean) => {
    const nextArr = checked
      ? [...currentArr, opt]
      : currentArr.filter((i) => i !== opt);
    onChange(nextArr);
  };

  return (
    <div className="space-y-3">
      <Label>{field.label}</Label>
      <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
        {!field.options || field.options.length === 0 ? (
          <p className="text-muted-foreground col-span-2 py-2 text-center text-xs italic">
            No boards detected. Connect to the backend to see available options.
          </p>
        ) : (
          field.options?.map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <Checkbox
                id={`${field.path}-${opt}`}
                checked={currentArr.includes(opt)}
                onCheckedChange={(checked) => handleToggle(opt, !!checked)}
              />
              <Label
                htmlFor={`${field.path}-${opt}`}
                className="cursor-pointer text-sm font-normal"
              >
                {opt}
              </Label>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
