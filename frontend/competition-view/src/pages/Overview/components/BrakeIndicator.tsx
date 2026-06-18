import { VCU } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

type BrakeStatus = "braked" | "unbraked" | "unknown";

const STATUS_STYLES: Record<BrakeStatus, { bg: string; text: string; label: string }> = {
  braked:   { bg: "bg-red-500/15 border-red-500",   text: "text-red-500",   label: "BRAKED"   },
  unbraked: { bg: "bg-blue-500/15 border-blue-500", text: "text-blue-500",  label: "UNBRAKED" },
  unknown:  { bg: "bg-muted border-border",          text: "text-muted-foreground", label: "—" },
};

/**
 * Large visual indicator that mirrors the control-station BrakeState widget.
 * Reads VCU/all_reeds — truthy means brakes are engaged.
 */
const BrakeIndicator = () => {
  const raw = useMeasurement(VCU.allReeds);

  const status: BrakeStatus =
    raw === undefined ? "unknown" : raw ? "braked" : "unbraked";

  const { bg, text, label } = STATUS_STYLES[status];

  return (
    <div
      className={`flex h-full min-h-24 flex-col items-center justify-center rounded-xl border-2 px-6 py-4 ${bg}`}
    >
      <span className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
        Brake State
      </span>
      <span className={`text-4xl font-black tracking-wide ${text}`}>
        {label}
      </span>
    </div>
  );
};

export default BrakeIndicator;
