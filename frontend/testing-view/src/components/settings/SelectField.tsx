import { Label } from "@workspace/ui/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/shadcn/select";
import type { FieldProps } from "../../types/common/settings";

export const SelectField = ({ field, value, onChange }: FieldProps<string>) => (
  <div className="space-y-2">
    <Label>{field.label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={field.placeholder || "Select an option"} />
      </SelectTrigger>
      <SelectContent>
        {field.options?.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
