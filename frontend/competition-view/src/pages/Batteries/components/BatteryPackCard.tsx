import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components";
import { hvbmsPack } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

interface BatteryPackCardProps {
  /** Pack number, 1-based (1–18). */
  packNumber: number;
}

const fmt = (v: number | boolean | string | undefined, decimals = 1) =>
  typeof v === "number" ? v.toFixed(decimals) : "—";

const BatteryPackCard = ({ packNumber }: BatteryPackCardProps) => {
  const keys = hvbmsPack(packNumber);

  const soc     = useMeasurement(keys.soc);
  const voltage = useMeasurement(keys.voltage);
  const temp    = useMeasurement(keys.temperature);
  const cell1   = useMeasurement(keys.cell1);
  const cell2   = useMeasurement(keys.cell2);
  const cell3   = useMeasurement(keys.cell3);
  const cell4   = useMeasurement(keys.cell4);
  const cell5   = useMeasurement(keys.cell5);
  const cell6   = useMeasurement(keys.cell6);

  const cells = [cell1, cell2, cell3, cell4, cell5, cell6];
  const cellNums = cells.filter((c): c is number => typeof c === "number");
  const cellMax = cellNums.length ? Math.max(...cellNums) : undefined;
  const cellMin = cellNums.length ? Math.min(...cellNums) : undefined;

  const socNum = typeof soc === "number" ? soc : null;
  const socColor =
    socNum === null ? "bg-muted"     :
    socNum < 15     ? "bg-red-500"   :
    socNum < 30     ? "bg-amber-500" :
                      "bg-green-500";

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3 pb-0">
        <CardTitle className="text-xs font-semibold">
          Pack {packNumber}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 px-3">
        {/* SOC bar */}
        <div className="flex items-center gap-2">
          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${socColor}`}
              style={{ width: `${socNum ?? 0}%` }}
            />
          </div>
          <span className="text-foreground w-10 text-right text-xs font-medium tabular-nums">
            {fmt(soc, 0)}%
          </span>
        </div>

        {/* Key values */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
          <Stat label="Voltage"  value={fmt(voltage)}      unit="V"  />
          <Stat label="Temp"     value={fmt(temp)}          unit="°C" />
          <Stat label="Cell max" value={fmt(cellMax, 3)}   unit="V"  />
          <Stat label="Cell min" value={fmt(cellMin, 3)}   unit="V"  />
        </div>
      </CardContent>
    </Card>
  );
};

const Stat = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) => (
  <div className="flex items-baseline justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium tabular-nums">
      {value} <span className="text-muted-foreground font-normal">{unit}</span>
    </span>
  </div>
);

export default BatteryPackCard;
