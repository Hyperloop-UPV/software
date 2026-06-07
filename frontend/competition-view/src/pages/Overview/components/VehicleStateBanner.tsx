import { Badge } from "@workspace/ui/components";
import { VCU } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

type StateCategory = "emergency" | "running" | "braking" | "idle" | "unknown";

const STATE_STYLES: Record<
  StateCategory,
  { banner: string; valueText: string; badgeClass: string }
> = {
  emergency: {
    banner:    "border-red-500/50 bg-red-500/5",
    valueText: "text-red-500 dark:text-red-400",
    badgeClass:"border-red-400 text-red-600 dark:text-red-400",
  },
  running: {
    banner:    "border-green-500/40 bg-green-500/5",
    valueText: "text-green-600 dark:text-green-400",
    badgeClass:"border-green-400 text-green-700 dark:text-green-400",
  },
  braking: {
    banner:    "border-amber-500/40 bg-amber-500/5",
    valueText: "text-amber-600 dark:text-amber-400",
    badgeClass:"border-amber-400 text-amber-700 dark:text-amber-400",
  },
  idle: {
    banner:    "bg-card border",
    valueText: "text-muted-foreground",
    badgeClass:"",
  },
  unknown: {
    banner:    "bg-card border",
    valueText: "text-foreground",
    badgeClass:"",
  },
};

const categorise = (state: string | number | boolean | undefined): StateCategory => {
  if (state === undefined) return "unknown";
  const s = String(state).toUpperCase();
  if (s.includes("EMERGENCY") || s.includes("FAULT") || s.includes("ERROR")) return "emergency";
  if (s.includes("RUN") || s.includes("NOMINAL") || s.includes("ACCELERAT")) return "running";
  if (s.includes("BRAKE") || s.includes("DECELER") || s.includes("WARN")) return "braking";
  if (s.includes("IDLE") || s.includes("READY") || s.includes("STANDBY")) return "idle";
  return "unknown";
};

/**
 * Full-width banner showing the vehicle's general and operational states.
 * Background and text colour change based on the detected state category:
 *   - Emergency / Fault / Error  → red
 *   - Running / Nominal          → green
 *   - Braking / Decelerating     → amber
 *   - Idle / Ready / Standby     → muted
 */
const VehicleStateBanner = () => {
  const generalState     = useMeasurement(VCU.generalState);
  const operationalState = useMeasurement(VCU.operationalState);

  const category = categorise(generalState);
  const { banner, valueText, badgeClass } = STATE_STYLES[category];

  return (
    <div className={`flex items-center justify-between rounded-xl border px-6 py-4 shadow-sm transition-colors duration-300 ${banner}`}>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Vehicle State
        </span>
        <span className={`text-2xl font-black tracking-wide transition-colors duration-300 ${valueText}`}>
          {generalState !== undefined ? String(generalState) : "—"}
        </span>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Operational State
        </span>
        <Badge
          variant="outline"
          className={`px-3 py-1 text-sm font-semibold transition-colors duration-300 ${badgeClass}`}
        >
          {operationalState !== undefined ? String(operationalState) : "—"}
        </Badge>
      </div>
    </div>
  );
};

export default VehicleStateBanner;
