import {
  Checkbox,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hyperloop-upv/frontend-kit/components";
import type { CommandParameter, NumericParameter, ParameterValues } from "../../../types/catalog";

/** True when the field holds a number outside the parameter's safeRange (empty/NaN doesn't count). */
export const isNumericValueOutOfRange = (param: NumericParameter, raw: unknown): boolean => {
  const value = parseFloat(String(raw));
  if (!Number.isFinite(value)) return false;
  const [min, max] = param.safeRange;
  return (min != null && value < min) || (max != null && value > max);
};

const rangeLabel = (min: number | null, max: number | null): string => {
  if (min != null && max != null) return `between ${min} and ${max}`;
  if (min != null) return `at least ${min}`;
  return `at most ${max}`;
};

interface OrderParametersProps {
  fields: Record<string, CommandParameter>;
  values: ParameterValues;
  onChange: (key: string, value: string | number | boolean) => void;
}

/** Compact parameter form for orders that take fields (e.g. Propulsion Parameterized). */
const OrderParameters = ({ fields, values, onChange }: OrderParametersProps) => (
  <div className="flex flex-col gap-3">
    {Object.entries(fields).map(([key, param]) => (
      <Field key={key}>
        <FieldLabel htmlFor={`param-${key}`}>{param.name}</FieldLabel>
        {param.kind === "numeric" && (
          <>
            <Input
              id={`param-${key}`}
              type="number"
              min={param.safeRange[0] ?? undefined}
              max={param.safeRange[1] ?? undefined}
              value={String(values[key] ?? "")}
              onChange={(e) => onChange(key, e.target.value)}
              aria-invalid={isNumericValueOutOfRange(param, values[key]) || undefined}
              placeholder={
                param.safeRange[0] != null && param.safeRange[1] != null
                  ? `${param.safeRange[0]}–${param.safeRange[1]}`
                  : undefined
              }
            />
            {isNumericValueOutOfRange(param, values[key]) && (
              <p className="text-destructive text-xs">
                Must be {rangeLabel(param.safeRange[0], param.safeRange[1])}.
              </p>
            )}
          </>
        )}
        {param.kind === "enum" && (
          <Select value={String(values[key] ?? "")} onValueChange={(v) => onChange(key, v)}>
            <SelectTrigger id={`param-${key}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {param.options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {param.kind === "boolean" && (
          <Checkbox
            id={`param-${key}`}
            checked={Boolean(values[key])}
            onCheckedChange={(checked) => onChange(key, checked === true)}
          />
        )}
      </Field>
    ))}
  </div>
);

export default OrderParameters;
