import { Checkbox } from "@hyperloop-upv/frontend-kit/components/shadcn/checkbox";
import { Label } from "@hyperloop-upv/frontend-kit/components/shadcn/label";
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
