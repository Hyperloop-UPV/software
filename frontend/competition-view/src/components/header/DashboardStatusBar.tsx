import { Button, Separator } from "@workspace/ui/components";
import { useState } from "react";
import { VCU } from "../../constants/measurements";
import {
  BRAKE_ORDERS,
  EMERGENCY_STOP_ORDERS,
  OPEN_CONTACTORS_ORDERS,
} from "../../constants/orders";
import useMeasurement from "../../hooks/useMeasurement";
import useSendOrder from "../../hooks/useSendOrder";

/* ─── State colour helper ────────────────────────────────────────────────── */

const stateColor = (state: string | number | boolean | undefined): string => {
  if (state === undefined) return "text-muted-foreground";
  const s = String(state).toUpperCase();
  if (s.includes("EMERGENCY") || s.includes("FAULT") || s.includes("ERROR")) return "text-red-500";
  if (s.includes("RUN") || s.includes("NOMINAL") || s.includes("ACCELERAT")) return "text-green-500";
  if (s.includes("BRAKE") || s.includes("DECELER") || s.includes("WARN")) return "text-amber-500";
  return "text-muted-foreground";
};

/* ─── Emergency stop button (requires two clicks within 2 s) ────────────── */

const EStopButton = ({ onConfirm }: { onConfirm: () => void }) => {
  const [armed, setArmed] = useState(false);

  const handleClick = () => {
    if (armed) { onConfirm(); setArmed(false); return; }
    setArmed(true);
    setTimeout(() => setArmed(false), 2000);
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      className={armed
        ? "animate-pulse border-red-600 bg-red-600 text-white hover:bg-red-700"
        : "border-red-500 text-red-600 hover:bg-red-500/10 dark:text-red-400"
      }
    >
      {armed ? "⚠ Confirm E-Stop" : "⚠ E-Stop"}
    </Button>
  );
};

/* ─── Compact status label ───────────────────────────────────────────────── */

const StatusLabel = ({
  heading,
  value,
  valueClass = "text-foreground",
}: {
  heading: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="flex flex-col gap-0">
    <span className="text-muted-foreground text-[10px] leading-none font-medium uppercase tracking-widest">
      {heading}
    </span>
    <span className={`text-sm font-bold leading-tight ${valueClass}`}>{value}</span>
  </div>
);

/* ─── DashboardStatusBar ─────────────────────────────────────────────────── */

const DashboardStatusBar = () => {
  const sendOrder = useSendOrder();

  const generalState     = useMeasurement(VCU.generalState);
  const operationalState = useMeasurement(VCU.operationalState);
  const brakeRaw         = useMeasurement(VCU.allReeds);

  const brakeLabel = brakeRaw === undefined ? "—" : brakeRaw ? "BRAKED" : "UNBRAKED";
  const brakeClass =
    brakeRaw === true  ? "text-red-500"  :
    brakeRaw === false ? "text-blue-500" :
    "text-muted-foreground";

  return (
    <div className="flex items-center gap-3">
      <StatusLabel
        heading="State"
        value={generalState !== undefined ? String(generalState) : "—"}
        valueClass={stateColor(generalState)}
      />

      <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />

      <StatusLabel
        heading="Op. State"
        value={operationalState !== undefined ? String(operationalState) : "—"}
      />

      <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />

      <StatusLabel heading="Brake" value={brakeLabel} valueClass={brakeClass} />

      <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />

      <Button
        size="sm"
        variant="outline"
        onClick={() => sendOrder(BRAKE_ORDERS)}
      >
        Brake
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="border-amber-500 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
        onClick={() => sendOrder(OPEN_CONTACTORS_ORDERS)}
      >
        Open Contactors
      </Button>

      <EStopButton onConfirm={() => sendOrder(EMERGENCY_STOP_ORDERS)} />
    </div>
  );
};

export default DashboardStatusBar;
