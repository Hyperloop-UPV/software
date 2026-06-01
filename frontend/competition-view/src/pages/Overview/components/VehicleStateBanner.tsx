import { Badge } from "@workspace/ui/components";
import { VCU } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

/**
 * Full-width banner showing the vehicle's general and operational states.
 * This is the single most important indicator on the competition dashboard.
 */
const VehicleStateBanner = () => {
  const generalState = useMeasurement(VCU.generalState);
  const operationalState = useMeasurement(VCU.operationalState);

  return (
    <div className="bg-card flex items-center justify-between rounded-xl border px-6 py-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Vehicle State
        </span>
        <span className="text-foreground text-2xl font-bold">
          {generalState !== undefined ? String(generalState) : "—"}
        </span>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Operational State
        </span>
        <Badge
          variant="outline"
          className="px-3 py-1 text-sm font-semibold"
        >
          {operationalState !== undefined ? String(operationalState) : "—"}
        </Badge>
      </div>
    </div>
  );
};

export default VehicleStateBanner;
