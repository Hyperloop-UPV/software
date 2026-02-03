import { Checkbox } from "@workspace/ui/components/shadcn/checkbox";
import { Label } from "@workspace/ui/components/shadcn/label";
import type { FieldProps } from "../../types/common/settings";

export const BooleanField = ({
  field,
  value,
  onChange,
}: FieldProps<boolean>) => (
  <div className="flex items-center space-x-2">
    <Checkbox
      id={field.path}
      checked={!!value}
      onCheckedChange={(checked) => onChange(!!checked)}
    />
    <Label htmlFor={field.path} className="cursor-pointer">
      {field.label}
    </Label>
  </div>
);
