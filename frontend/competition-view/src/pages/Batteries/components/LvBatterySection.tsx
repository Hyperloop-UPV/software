import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components";
import { LVBMS } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

const CELL_MIN = 3.0;
const CELL_MAX = 4.2;
const CELL_WARN_LOW  = 3.1;
const CELL_WARN_HIGH = 4.15;

const fmt = (v: number | boolean | string | undefined, decimals = 2) =>
  typeof v === "number" ? v.toFixed(decimals) : "—";

/* ─── Cell tile (same style as HV) ──────────────────────────────────────── */

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
      className={`flex flex-col gap-0.5 rounded border px-1.5 py-1.5 ${
        isLow  ? "border-red-500 bg-red-500/5" :
        isHigh ? "border-amber-500 bg-amber-500/5" :
                 "border-border"
      }`}
    >
      <span className="text-muted-foreground text-[9px] leading-none">Cell {cellNum}</span>
      <div className="bg-muted h-0.5 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${isLow ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-green-500"}`}
          style={{ width: `${fill}%` }}
        />
      </div>
      <span
        className={`text-xs font-semibold tabular-nums leading-none ${
          isLow ? "text-red-500" : isHigh ? "text-amber-500" : "text-foreground"
        }`}
      >
        {v !== null ? v.toFixed(3) : "—"}
        <span className="text-muted-foreground ml-0.5 text-[10px] font-normal">V</span>
      </span>
    </div>
  );
};

/* ─── LV section ─────────────────────────────────────────────────────────── */

const LvBatterySection = () => {
  const soc          = useMeasurement(LVBMS.soc);
  const totalVoltage = useMeasurement(LVBMS.totalVoltage);
  const voltageMax   = useMeasurement(LVBMS.voltageMax);
  const voltageMin   = useMeasurement(LVBMS.voltageMin);
  const tempMax      = useMeasurement(LVBMS.tempMax);
  const tempMin      = useMeasurement(LVBMS.tempMin);
  const current      = useMeasurement(LVBMS.current);
  const state        = useMeasurement(LVBMS.generalState);

  const socNum   = typeof soc === "number" ? soc : null;
  const socColor =
    socNum === null ? "bg-muted"     :
    socNum < 20     ? "bg-red-500"   :
    socNum < 40     ? "bg-amber-500" :
                      "bg-green-500";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-foreground text-base font-semibold">Low Voltage</h2>
        <span className="text-muted-foreground text-xs">1 group · 6 cells</span>
        {state !== undefined && (
          <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
            {String(state)}
          </span>
        )}
      </div>

      <Card className="gap-2 py-3">
        <CardHeader className="px-3 pb-0">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm font-semibold">Group 1</CardTitle>
            <div className="flex items-center gap-1.5 w-48">
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

        <CardContent className="flex flex-col gap-3 px-3">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-6">
            {[
              { label: "Total V",  value: fmt(totalVoltage), unit: "V"  },
              { label: "Current",  value: fmt(current),      unit: "A"  },
              { label: "V max",    value: fmt(voltageMax),   unit: "V"  },
              { label: "V min",    value: fmt(voltageMin),   unit: "V"  },
              { label: "T max",    value: fmt(tempMax, 1),   unit: "°C" },
              { label: "T min",    value: fmt(tempMin, 1),   unit: "°C" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="flex items-baseline justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-medium tabular-nums">
                  {value} <span className="text-muted-foreground font-normal">{unit}</span>
                </span>
              </div>
            ))}
          </div>

          {/* 6-cell grid */}
          <div className="grid grid-cols-6 gap-2">
            {LVBMS.cells.map((key, i) => (
              <CellTile key={key} cellNum={i + 1} measurementKey={key} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default LvBatterySection;
