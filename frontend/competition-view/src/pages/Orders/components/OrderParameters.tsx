import {
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import type {
  BooleanParameter,
  CommandParameter,
  EnumParameter,
  NumericParameter,
  ParameterValues,
} from "../../../types/catalog";

interface OrderParametersProps {
  fields: Record<string, CommandParameter>;
  values: ParameterValues;
  onChange: (id: string, value: string | number | boolean) => void;
}

/**
 * Renders a form field for each command parameter.
 * Numeric → Input with range hint, Enum → Select, Boolean → Checkbox.
 * All input components come from @workspace/ui.
 */
const OrderParameters = ({ fields, values, onChange }: OrderParametersProps) => (
  <div className="flex flex-col gap-3">
    {Object.entries(fields).map(([key, param]) => (
      <ParameterField
        key={key}
        fieldKey={key}
        param={param}
        value={values[key]}
        onChange={onChange}
      />
    ))}
  </div>
);

/* ─── Helpers ───────────────────────────────────────────────────────────── */

/** Returns false if `val` is outside the [min, max] range (null = unbounded). */
const inRange = (val: number, range: (number | null)[]): boolean => {
  const [min, max] = range;
  if (min !== null && val < min) return false;
  if (max !== null && val > max) return false;
  return true;
};

const formatBound = (v: number | null, fallback: string) =>
  v === null ? fallback : String(v);

/* ─── Per-type field renderers ─────────────────────────────────────────── */

interface FieldProps {
  fieldKey: string;
  param: CommandParameter;
  value: ParameterValues[string];
  onChange: (id: string, value: string | number | boolean) => void;
}

const ParameterField = ({ fieldKey, param, value, onChange }: FieldProps) => {
  switch (param.kind) {
    case "numeric":
      return <NumericField fieldKey={fieldKey} param={param} value={value as string} onChange={onChange} />;
    case "enum":
      return <EnumField    fieldKey={fieldKey} param={param} value={value as string} onChange={onChange} />;
    case "boolean":
      return <BooleanField fieldKey={fieldKey} param={param} value={value as boolean} onChange={onChange} />;
  }
};

const NumericField = ({
  fieldKey,
  param,
  value,
  onChange,
}: {
  fieldKey: string;
  param: NumericParameter;
  value: string;
  onChange: FieldProps["onChange"];
}) => {
  const n             = parseFloat(value);
  const hasValue      = value !== "" && Number.isFinite(n);
  const outOfSafe     = hasValue && param.safeRange.length >= 2    && !inRange(n, param.safeRange);
  const outOfWarning  = hasValue && param.warningRange.length >= 2 && !inRange(n, param.warningRange);

  // Visual state: red > amber > default
  const borderClass = outOfSafe
    ? "border-red-500 focus-visible:ring-red-500"
    : outOfWarning
      ? "border-amber-500 focus-visible:ring-amber-500"
      : "";

  // Build hint text from safeRange when present
  const hasRange = param.safeRange.length >= 2 &&
    (param.safeRange[0] !== null || param.safeRange[1] !== null);
  const rangeHint = hasRange
    ? `Range: ${formatBound(param.safeRange[0], "−∞")} – ${formatBound(param.safeRange[1], "+∞")}`
    : null;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={fieldKey} className="text-xs">{param.name}</Label>
      <Input
        id={fieldKey}
        type="number"
        placeholder={param.name}
        value={value ?? ""}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        className={`h-8 text-xs ${borderClass}`}
      />
      {/* Range validation feedback */}
      {outOfSafe && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Value is outside the safe range ({formatBound(param.safeRange[0], "−∞")} – {formatBound(param.safeRange[1], "+∞")})
        </p>
      )}
      {!outOfSafe && outOfWarning && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Value is outside the recommended range ({formatBound(param.warningRange[0], "−∞")} – {formatBound(param.warningRange[1], "+∞")})
        </p>
      )}
      {!outOfSafe && !outOfWarning && rangeHint && (
        <p className="text-muted-foreground text-xs">{rangeHint}</p>
      )}
    </div>
  );
};

const EnumField = ({
  fieldKey,
  param,
  value,
  onChange,
}: {
  fieldKey: string;
  param: EnumParameter;
  value: string;
  onChange: FieldProps["onChange"];
}) => (
  <div className="flex flex-col gap-1">
    <Label htmlFor={fieldKey} className="text-xs">{param.name}</Label>
    <Select
      value={value ?? param.options[0]}
      onValueChange={(v) => onChange(fieldKey, v)}
    >
      <SelectTrigger id={fieldKey} className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {param.options.map((opt) => (
          <SelectItem key={opt} value={opt} className="text-xs">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const BooleanField = ({
  fieldKey,
  param,
  value,
  onChange,
}: {
  fieldKey: string;
  param: BooleanParameter;
  value: boolean;
  onChange: FieldProps["onChange"];
}) => (
  <div className="flex items-center gap-2">
    <Checkbox
      id={fieldKey}
      checked={!!value}
      onCheckedChange={(checked) => onChange(fieldKey, !!checked)}
    />
    <Label htmlFor={fieldKey} className="cursor-pointer text-xs">
      {param.name}
    </Label>
  </div>
);

export default OrderParameters;
