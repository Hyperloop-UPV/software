import { Input } from "@workspace/ui/components/shadcn/input";
import { Label } from "@workspace/ui/components/shadcn/label";
import type { FieldProps } from "../../types/common/settings";

export const TextField = ({ field, value, onChange }: FieldProps<string>) => (
  <div className="space-y-2">
    <Label>{field.label}</Label>
    <Input
      type="text"
      value={value?.toString() ?? ""}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);
