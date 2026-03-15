import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components";
import { Label } from "@workspace/ui/components/shadcn/label";
import { useState } from "react";
import type { FieldProps } from "../../types/common/settings";

export const ComboboxField = ({
  field,
  value,
  onChange,
  loading,
}: FieldProps<string>) => {
  const predefined = field.options ?? [];
  const items =
    value && !predefined.includes(value) ? [value, ...predefined] : predefined;

  const [inputValue, setInputValue] = useState(value ?? "");

  const commitInput = () => {
    if (inputValue && inputValue !== value) onChange(inputValue);
  };

  return (
    <div className="w-70 space-y-2">
      <Label>{field.label}</Label>
      <Combobox
        items={items}
        value={value ?? null}
        onValueChange={(v) => {
          onChange(v ?? "");
          setInputValue(v ?? "");
        }}
      >
        <ComboboxInput
          placeholder={
            loading ? "Loading..." : (field.placeholder ?? "Choose or type...")
          }
          disabled={loading}
          value={inputValue}
          onChange={(e) => {
            if (e.target.value !== value) setInputValue(e.target.value);
          }}
          onBlur={commitInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitInput();
          }}
        />
        <ComboboxContent>
          <ComboboxEmpty>No branches found</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
};

export default ComboboxField;
