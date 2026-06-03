import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components";
import { LCU } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

/** Warning threshold in mm — highlights airgap values that are too low. */
const AIRGAP_MIN_MM = 5;

const fmt = (v: number | boolean | string | undefined) =>
  typeof v === "number" ? v.toFixed(1) : "—";

interface AirgapRowProps {
  label: string;
  measurementKey: string;
}

const AirgapRow = ({ label, measurementKey }: AirgapRowProps) => {
  const value = useMeasurement(measurementKey);
  const isLow = typeof value === "number" && value < AIRGAP_MIN_MM;

  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-medium tabular-nums ${
          isLow ? "text-amber-500" : "text-foreground"
        }`}
      >
        {fmt(value)}
        <span className="text-muted-foreground ml-0.5 font-normal">mm</span>
      </span>
    </div>
  );
};

/**
 * LCU airgap card — shows vertical and horizontal sensor readings
 * with a warning highlight when any gap falls below the minimum threshold.
 */
const LcuAirgapCard = () => (
  <Card className="gap-3 py-4">
    <CardHeader className="px-4 pb-0">
      <CardTitle className="text-sm font-semibold">LCU — Airgap</CardTitle>
    </CardHeader>

    <CardContent className="flex flex-col gap-3 px-4">
      <div>
        <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wider">
          Vertical
        </p>
        <div className="flex flex-col gap-1">
          <AirgapRow label="Airgap 1" measurementKey={LCU.verticalAirgap1} />
          <AirgapRow label="Airgap 2" measurementKey={LCU.verticalAirgap2} />
          <AirgapRow label="Airgap 3" measurementKey={LCU.verticalAirgap3} />
          <AirgapRow label="Airgap 4" measurementKey={LCU.verticalAirgap4} />
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wider">
          Horizontal
        </p>
        <div className="flex flex-col gap-1">
          <AirgapRow label="Airgap 5" measurementKey={LCU.horizontalAirgap1} />
          <AirgapRow label="Airgap 6" measurementKey={LCU.horizontalAirgap2} />
          <AirgapRow label="Airgap 7" measurementKey={LCU.horizontalAirgap3} />
          <AirgapRow label="Airgap 8" measurementKey={LCU.horizontalAirgap4} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default LcuAirgapCard;
