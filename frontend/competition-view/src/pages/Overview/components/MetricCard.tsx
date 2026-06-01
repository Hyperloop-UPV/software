import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components";

interface MetricCardProps {
  label: string;
  value: string | number | undefined;
  unit?: string;
  /** Extra Tailwind classes applied to the value text. */
  valueClassName?: string;
}

/**
 * Displays a single numeric or enum telemetry measurement.
 * Shows an em-dash when no data has arrived yet.
 */
const MetricCard = ({
  label,
  value,
  unit,
  valueClassName = "",
}: MetricCardProps) => {
  const display = value !== undefined ? String(value) : "—";

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className={`text-foreground text-3xl font-bold tabular-nums ${valueClassName}`}>
          {display}
          {value !== undefined && unit && (
            <span className="text-muted-foreground ml-1 text-sm font-normal">
              {unit}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
