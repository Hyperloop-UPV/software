import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components";
import { LCU } from "../../../constants/measurements";
import useMeasurement from "../../../hooks/useMeasurement";

/** Airgap warning threshold in mm. */
const AIRGAP_WARN_MM = 5;

const fmt = (v: number | boolean | string | undefined, decimals = 1) =>
  typeof v === "number" ? v.toFixed(decimals) : "—";

/* ─── Shared row components ────────────────────────────────────────────── */

interface MeasurementRowProps {
  label: string;
  measurementKey: string;
  unit: string;
  decimals?: number;
  warnBelow?: number;
}

const MeasurementRow = ({
  label,
  measurementKey,
  unit,
  decimals = 1,
  warnBelow,
}: MeasurementRowProps) => {
  const value = useMeasurement(measurementKey);
  const isWarning =
    warnBelow !== undefined &&
    typeof value === "number" &&
    value < warnBelow;

  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-medium tabular-nums ${
          isWarning ? "text-amber-500" : "text-foreground"
        }`}
      >
        {fmt(value, decimals)}
        <span className="text-muted-foreground ml-0.5 font-normal">{unit}</span>
      </span>
    </div>
  );
};

/* ─── Section components ───────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
    {children}
  </p>
);

const PositionSection = () => (
  <div>
    <SectionLabel>Position</SectionLabel>
    <div className="flex flex-col gap-1">
      <MeasurementRow label="Y" measurementKey={LCU.positionY} unit="mm" decimals={2} />
      <MeasurementRow label="Z" measurementKey={LCU.positionZ} unit="mm" decimals={2} />
    </div>
  </div>
);

const RotationSection = () => (
  <div>
    <SectionLabel>Rotation</SectionLabel>
    <div className="flex flex-col gap-1">
      <MeasurementRow label="Pitch" measurementKey={LCU.rotationPitch} unit="°" decimals={2} />
      <MeasurementRow label="Roll"  measurementKey={LCU.rotationRoll}  unit="°" decimals={2} />
      <MeasurementRow label="Yaw"   measurementKey={LCU.rotationYaw}   unit="°" decimals={2} />
    </div>
  </div>
);

const VerticalAirgapsSection = () => (
  <div>
    <SectionLabel>Vertical Airgaps</SectionLabel>
    <div className="flex flex-col gap-1">
      <MeasurementRow label="V1" measurementKey={LCU.verticalAirgap1} unit="mm" warnBelow={AIRGAP_WARN_MM} />
      <MeasurementRow label="V2" measurementKey={LCU.verticalAirgap2} unit="mm" warnBelow={AIRGAP_WARN_MM} />
      <MeasurementRow label="V3" measurementKey={LCU.verticalAirgap3} unit="mm" warnBelow={AIRGAP_WARN_MM} />
      <MeasurementRow label="V4" measurementKey={LCU.verticalAirgap4} unit="mm" warnBelow={AIRGAP_WARN_MM} />
    </div>
  </div>
);

const HorizontalAirgapsSection = () => (
  <div>
    <SectionLabel>Horizontal Airgaps</SectionLabel>
    <div className="flex flex-col gap-1">
      <MeasurementRow label="H1" measurementKey={LCU.horizontalAirgap1} unit="mm" warnBelow={AIRGAP_WARN_MM} />
      <MeasurementRow label="H2" measurementKey={LCU.horizontalAirgap2} unit="mm" warnBelow={AIRGAP_WARN_MM} />
      <MeasurementRow label="H3" measurementKey={LCU.horizontalAirgap3} unit="mm" warnBelow={AIRGAP_WARN_MM} />
      <MeasurementRow label="H4" measurementKey={LCU.horizontalAirgap4} unit="mm" warnBelow={AIRGAP_WARN_MM} />
    </div>
  </div>
);

/* ─── Main card ─────────────────────────────────────────────────────────── */

import React from "react";

/**
 * Full levitation status card for the LCU.
 * Displays position, rotation, and all 8 airgap sensors in a 4-column grid.
 * Airgap values below 5 mm are highlighted in amber.
 */
const LcuAirgapCard = () => (
  <Card className="gap-3 py-4">
    <CardHeader className="px-4 pb-0">
      <CardTitle className="text-sm font-semibold">LCU — Levitation</CardTitle>
    </CardHeader>

    <CardContent className="px-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <PositionSection />
        <RotationSection />
        <VerticalAirgapsSection />
        <HorizontalAirgapsSection />
      </div>
    </CardContent>
  </Card>
);

export default LcuAirgapCard;
