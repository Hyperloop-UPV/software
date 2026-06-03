import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components";
import useMeasurement from "../../../hooks/useMeasurement";

interface Stat {
  label: string;
  measurementKey: string;
  unit?: string;
  decimals?: number;
}

interface BoardCardProps {
  /** Display name shown in the card header. */
  name: string;
  /** Measurement key for the board's general/operational state string. */
  stateMeasurementKey: string;
  /** Additional stats shown in a compact grid below the state. */
  stats?: Stat[];
}

/**
 * Generic board status card.
 * Shows a state badge and an optional grid of secondary measurements.
 */
const BoardCard = ({ name, stateMeasurementKey, stats = [] }: BoardCardProps) => {
  const state = useMeasurement(stateMeasurementKey);
  const hasData = state !== undefined;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-semibold">{name}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              !hasData
                ? "border-border text-muted-foreground"
                : "border-green-500 text-green-600 dark:text-green-400"
            }`}
          >
            {hasData ? String(state) : "—"}
          </span>
        </CardTitle>
      </CardHeader>

      {stats.length > 0 && (
        <CardContent className="px-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {stats.map((s) => (
              <StatRow key={s.measurementKey} stat={s} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

const StatRow = ({ stat }: { stat: Stat }) => {
  const raw = useMeasurement(stat.measurementKey);
  const display =
    typeof raw === "number"
      ? raw.toFixed(stat.decimals ?? 1)
      : raw !== undefined
        ? String(raw)
        : "—";

  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-muted-foreground truncate">{stat.label}</span>
      <span className="text-foreground ml-2 shrink-0 font-medium tabular-nums">
        {display}
        {raw !== undefined && stat.unit && (
          <span className="text-muted-foreground ml-0.5">{stat.unit}</span>
        )}
      </span>
    </div>
  );
};

export default BoardCard;
