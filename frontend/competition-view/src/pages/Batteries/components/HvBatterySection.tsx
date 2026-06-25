import { Separator } from "@workspace/ui/components";
import { HVBMS, HVBMS_CABINET } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";
import BatteryPackCard from "./BatteryPackCard";

const PACK_COUNT = 8;
const PACK_NUMBERS = Array.from({ length: PACK_COUNT }, (_, i) => i + 1);

const fmt = (v: number | boolean | string | undefined, decimals = 1) =>
  typeof v === "number" ? v.toFixed(decimals) : "—";

const HvBatterySection = () => {
  const totalVoltage = useMeasurement(HVBMS.batteriesVoltage);
  const voltageMax   = useMeasurement(HVBMS.voltageMax);
  const voltageMin   = useMeasurement(HVBMS.voltageMin);
  const tempMax      = useMeasurement(HVBMS.tempMax);
  const tempMin      = useMeasurement(HVBMS.tempMin);
  const soc          = useMeasurement(HVBMS.minimumSoc);
  const contactors   = useMeasurement(HVBMS_CABINET.contactorsState);

  return (
    <section className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h2 className="text-foreground text-base font-semibold">High Voltage</h2>
        <span className="text-muted-foreground text-xs">8 groups · 12 cells each</span>
        {contactors !== undefined && (
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              contactors === "Close"
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-red-500 text-red-600 dark:text-red-400"
            }`}
          >
            Contactors {contactors}
          </span>
        )}
      </div>

      {/* Summary stats */}
      <div className="bg-card grid grid-cols-3 gap-px overflow-hidden rounded-xl border shadow-sm sm:grid-cols-6">
        {[
          { label: "Total V",  value: fmt(totalVoltage), unit: "V"  },
          { label: "Min SOC",  value: fmt(soc, 0),        unit: "%"  },
          { label: "V max",    value: fmt(voltageMax, 3), unit: "V"  },
          { label: "V min",    value: fmt(voltageMin, 3), unit: "V"  },
          { label: "T max",    value: fmt(tempMax),       unit: "°C" },
          { label: "T min",    value: fmt(tempMin),       unit: "°C" },
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

      {/* Group grid: 2 rows of 4 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PACK_NUMBERS.map((n) => (
          <BatteryPackCard key={n} packNumber={n} />
        ))}
      </div>
    </section>
  );
};

export default HvBatterySection;
