import { Separator } from "@workspace/ui/components";
import { LVBMS } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

const fmt = (v: number | boolean | string | undefined, decimals = 2) =>
  typeof v === "number" ? v.toFixed(decimals) : "—";

/**
 * Low-voltage battery section: BMSL summary stats + individual cell voltages.
 */
const LvBatterySection = () => {
  const soc          = useMeasurement(LVBMS.soc);
  const totalVoltage = useMeasurement(LVBMS.totalVoltage);
  const voltageMax   = useMeasurement(LVBMS.voltageMax);
  const voltageMin   = useMeasurement(LVBMS.voltageMin);
  const tempMax      = useMeasurement(LVBMS.tempMax);
  const tempMin      = useMeasurement(LVBMS.tempMin);
  const current      = useMeasurement(LVBMS.current);
  const state        = useMeasurement(LVBMS.generalState);

  return (
    <section className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h2 className="text-foreground text-base font-semibold">
          Low Voltage (LVBMS)
        </h2>
        {state !== undefined && (
          <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
            {String(state)}
          </span>
        )}
      </div>

      {/* Summary stats */}
      <div className="bg-card grid grid-cols-3 gap-px overflow-hidden rounded-xl border shadow-sm sm:grid-cols-7">
        {[
          { label: "SOC",      value: fmt(soc, 0),        unit: "%"  },
          { label: "Total V",  value: fmt(totalVoltage),  unit: "V"  },
          { label: "Current",  value: fmt(current),       unit: "A"  },
          { label: "V max",    value: fmt(voltageMax),    unit: "V"  },
          { label: "V min",    value: fmt(voltageMin),    unit: "V"  },
          { label: "T max",    value: fmt(tempMax, 1),    unit: "°C" },
          { label: "T min",    value: fmt(tempMin, 1),    unit: "°C" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-card flex flex-col items-center py-3">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-foreground text-sm font-semibold tabular-nums">
              {value}
              <span className="text-muted-foreground ml-0.5 text-xs font-normal">
                {unit}
              </span>
            </span>
          </div>
        ))}
      </div>

      <Separator />

      {/* Individual cell voltages */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {LVBMS.cells.map((key, i) => (
          <CellCard key={key} cellNumber={i + 1} measurementKey={key} />
        ))}
      </div>
    </section>
  );
};

/* ─── Sub-component ───────────────────────────────────────────────────── */

interface CellCardProps {
  cellNumber: number;
  measurementKey: string;
}

const CELL_MIN     = 3.0;
const CELL_MAX     = 4.2;

const CellCard = ({ cellNumber, measurementKey }: CellCardProps) => {
  const voltage = useMeasurement(measurementKey);
  const v = typeof voltage === "number" ? voltage : null;

  const isLow  = v !== null && v < CELL_MIN + 0.1;
  const isHigh = v !== null && v > CELL_MAX - 0.05;

  // Fill percentage within the useful range
  const fill =
    v !== null
      ? Math.min(100, Math.max(0, ((v - CELL_MIN) / (CELL_MAX - CELL_MIN)) * 100))
      : 0;

  return (
    <div
      className={`bg-card flex flex-col items-center gap-1 rounded-xl border px-3 py-3 shadow-sm ${
        isLow ? "border-red-500" : isHigh ? "border-amber-500" : ""
      }`}
    >
      <span className="text-muted-foreground text-xs">Cell {cellNumber}</span>

      {/* Mini bar */}
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${
            isLow ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-green-500"
          }`}
          style={{ width: `${fill}%` }}
        />
      </div>

      <span
        className={`text-sm font-semibold tabular-nums ${
          isLow ? "text-red-500" : isHigh ? "text-amber-500" : "text-foreground"
        }`}
      >
        {v !== null ? v.toFixed(3) : "—"}
        <span className="text-muted-foreground ml-0.5 text-xs font-normal">V</span>
      </span>
    </div>
  );
};

export default LvBatterySection;
