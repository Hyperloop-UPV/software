import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components";
import { Button } from "@workspace/ui/components/shadcn/button";
import { Label } from "@workspace/ui/components/shadcn/label";
import { RefreshCw } from "@workspace/ui/icons";
import { useEffect, useState } from "react";
import type { BranchesFetchState } from "../../hooks/useBranches";
import type { FieldProps } from "../../types/common/settings";

export const ComboboxField = ({
  field,
  value,
  onChange,
  loading,
  fetchState,
}: FieldProps<string> & { fetchState?: BranchesFetchState }) => {
  const predefined = field.options ?? [];
  const items =
    value && !predefined.includes(value) ? [value, ...predefined] : predefined;

  const [inputValue, setInputValue] = useState(value ?? "");
  const [selectedValue, setSelectedValue] = useState<string | null>(value ?? null);

  // Sync when value prop changes (e.g. after external save)
  useEffect(() => {
    setInputValue(value ?? "");
    setSelectedValue(value ?? null);
  }, [value]);

  const commitInput = () => {
    if (inputValue !== value) onChange(inputValue);
  };

  return (
    <div className="w-70 space-y-2">
      <div className="flex items-center gap-2">
        <Label>{field.label}</Label>
        {fetchState && (
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchState.refetch}
            disabled={loading}
            className={`h-5 w-5 p-0 ${fetchState.error ? "text-destructive hover:text-destructive" : ""}`}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>
      <Combobox
        items={items}
        value={selectedValue}
        onValueChange={(v) => {
          setSelectedValue(v);
          setInputValue(v ?? "");
          onChange(v ?? "");
        }}
      >
        <ComboboxInput
          placeholder={
            loading ? "Loading..." : (field.placeholder ?? "Choose or type...")
          }
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            // Clear selection so base-ui doesn't reset the input to the selected value
            setSelectedValue(null);
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
