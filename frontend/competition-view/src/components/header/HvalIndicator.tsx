import { Badge } from "@hyperloop-upv/frontend-kit/components";
import { useEffect, useState } from "react";
import { BOARDS, HVAL_THRESHOLD_V, HVBMS } from "../../constants/measurements";
import useMeasurement from "../../hooks/useMeasurement";

const FLASH_INTERVAL_MS = 500;

const HvalIndicator = () => {
  const voltage = useMeasurement(BOARDS.HVBMS, HVBMS.voltageReading) as number | undefined;
  const active = voltage !== undefined && voltage > HVAL_THRESHOLD_V;

  // Blinks the badge between a solid red fill and its normal outlined look,
  // mimicking a physical HVAL warning light rather than a smooth fade.
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    if (!active) {
      setSolid(false);
      return;
    }
    const id = setInterval(() => setSolid((s) => !s), FLASH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active]);

  return (
    // Fixed-width slot: "Active" vs "Inactive" differ in length, so without this
    // the badge would resize as HVAL toggles.
    <div className="w-32">
      <Badge
        variant="outline"
        className={`w-fit gap-1.5 px-2.5 py-1 text-sm whitespace-nowrap ${
          active
            ? solid
              ? "border-red-500 bg-red-500 text-white"
              : "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
            : "border-green-500 text-green-600 dark:text-green-400"
        }`}
      >
        <span
          className={`size-2 rounded-full ${
            active ? (solid ? "bg-white" : "bg-red-500") : "bg-green-500"
          }`}
        />
        HVAL
      </Badge>
    </div>
  );
};

export default HvalIndicator;
