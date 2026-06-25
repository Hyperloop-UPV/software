import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components";
import { hvbmsPack } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

interface BatteryPackCardProps {
  packNumber: number;
}

const CELL_MIN = 3.0;
const CELL_MAX = 4.2;
const CELL_WARN_LOW  = 3.1;
const CELL_WARN_HIGH = 4.15;

const fmt = (v: number | boolean | string | undefined, decimals = 1) =>
  typeof v === "number" ? v.toFixed(decimals) : "—";

/* ─── Individual cell tile ───────────────────────────────────────────────── */

const CellTile = ({ cellNum, measurementKey }: { cellNum: number; measurementKey: string }) => {
  const raw = useMeasurement(measurementKey);
  const v = typeof raw === "number" ? raw : null;
  const isLow  = v !== null && v < CELL_WARN_LOW;
  const isHigh = v !== null && v > CELL_WARN_HIGH;
  const fill = v !== null
    ? Math.min(100, Math.max(0, ((v - CELL_MIN) / (CELL_MAX - CELL_MIN)) * 100))
    : 0;

  return (
    <div
      className={`flex flex-col gap-0.5 rounded border px-1.5 py-1 ${
        isLow  ? "border-red-500 bg-red-500/5" :
        isHigh ? "border-amber-500 bg-amber-500/5" :
                 "border-border"
      }`}
    >
      <span className="text-muted-foreground text-[9px] leading-none">{cellNum}</span>
      <div className="bg-muted h-0.5 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${isLow ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-green-500"}`}
          style={{ width: `${fill}%` }}
        />
      </div>
      <span
        className={`text-[10px] font-medium tabular-nums leading-none ${
          isLow ? "text-red-500" : isHigh ? "text-amber-500" : "text-foreground"
        }`}
      >
        {v !== null ? v.toFixed(2) : "—"}
        <span className="text-muted-foreground ml-0.5 font-normal">V</span>
      </span>
    </div>
  );
};

/* ─── Pack card ──────────────────────────────────────────────────────────── */

const BatteryPackCard = ({ packNumber }: BatteryPackCardProps) => {
  const keys = hvbmsPack(packNumber);

  const soc     = useMeasurement(keys.soc);
  const voltage = useMeasurement(keys.voltage);
  const temp    = useMeasurement(keys.temperature);

  const socNum   = typeof soc === "number" ? soc : null;
  const socColor =
    socNum === null ? "bg-muted"     :
    socNum < 15     ? "bg-red-500"   :
    socNum < 30     ? "bg-amber-500" :
                      "bg-green-500";

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3 pb-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Group {packNumber}</CardTitle>
          <div className="flex items-center gap-1.5 flex-1 max-w-[60%]">
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${socColor}`}
                style={{ width: `${socNum ?? 0}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums w-8 text-right">
              {fmt(soc, 0)}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 px-3">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <Stat label="Voltage" value={fmt(voltage)} unit="V" />
          <Stat label="Temp"    value={fmt(temp)}    unit="°C" />
        </div>

        {/* 12-cell grid: 6 cols × 2 rows */}
        <div className="grid grid-cols-6 gap-1">
          {keys.cells.map((key, i) => (
            <CellTile key={key} cellNum={i + 1} measurementKey={key} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <div className="flex items-baseline justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium tabular-nums">
      {value} <span className="text-muted-foreground font-normal">{unit}</span>
    </span>
  </div>
);

export default BatteryPackCard;
