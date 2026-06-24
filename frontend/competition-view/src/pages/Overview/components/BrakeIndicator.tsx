import { VCU } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

type BrakeStatus = "braked" | "unbraked" | "unknown";

const STATUS_STYLES: Record<BrakeStatus, { bg: string; text: string; label: string }> = {
  braked:   { bg: "bg-red-500/15 border-red-500",   text: "text-red-500",   label: "BRAKED"   },
  unbraked: { bg: "bg-blue-500/15 border-blue-500", text: "text-blue-500",  label: "UNBRAKED" },
  unknown:  { bg: "bg-muted border-border",          text: "text-muted-foreground", label: "—" },
};

interface BrakeIndicatorProps {
  /** Reduces padding and font sizes to fit a compact metric strip. */
  compact?: boolean;
}

/**
 * Visual indicator that mirrors the control-station BrakeState widget.
 * Reads VCU/all_reeds — truthy means brakes are engaged.
 */
const BrakeIndicator = ({ compact = false }: BrakeIndicatorProps) => {
  const raw = useMeasurement(VCU.allReeds);

  const status: BrakeStatus =
    raw === undefined ? "unknown" : raw ? "braked" : "unbraked";

  const { bg, text, label } = STATUS_STYLES[status];

  return (
    <div
      className={`flex h-full flex-col items-center justify-center rounded-xl border-2 ${bg} ${compact ? "px-3" : "min-h-24 px-6 py-4"}`}
    >
      <span className={`text-muted-foreground font-medium tracking-widest uppercase ${compact ? "text-[10px] leading-none mb-0.5" : "text-xs mb-1"}`}>
        Brake State
      </span>
      <span className={`font-black tracking-wide ${text} ${compact ? "text-lg leading-tight" : "text-4xl"}`}>
        {label}
      </span>
    </div>
  );
};

export default BrakeIndicator;
