import { BCU, HVBMS, PCU, VCU } from "../../constants/measurements";
import MultiSeriesChart, { type SeriesConfig } from "./components/MultiSeriesChart";
import TelemetryChart from "./components/TelemetryChart";

/**
 * Real-time telemetry charts page.
 *
 * Row 1 — Kinematic:    Speed · Position
 * Row 2 — Electrical:   HV Battery SOC · Brake Pressure
 * Row 3 — Motor phase:  DLIM (PCU motorA U/V/W) · LSM (BCU average U/V/W)
 *
 * Each chart accumulates a rolling 500-point history and supports
 * click-drag zoom with double-click to reset.
 *
 * DLIM/LSM series configs are defined at module level so the
 * MultiSeriesChart's Zustand selector and uPlot init are stable.
 */

const DLIM_SERIES: SeriesConfig[] = [
  { measurementKey: PCU.motorCurrentU, label: "U", colorIndex: 0 },
  { measurementKey: PCU.motorCurrentV, label: "V", colorIndex: 1 },
  { measurementKey: PCU.motorCurrentW, label: "W", colorIndex: 2 },
];

const LSM_SERIES: SeriesConfig[] = [
  { measurementKey: BCU.averageCurrentU, label: "U", colorIndex: 0 },
  { measurementKey: BCU.averageCurrentV, label: "V", colorIndex: 1 },
  { measurementKey: BCU.averageCurrentW, label: "W", colorIndex: 2 },
];

const Charts = () => (
  <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Row 1 — Kinematic */}
      <TelemetryChart
        title="Speed"
        measurementKey={PCU.speed}
        unit="km/h"
        colorIndex={0}
      />
      <TelemetryChart
        title="Position"
        measurementKey={PCU.position}
        unit="m"
        colorIndex={1}
      />

      {/* Row 2 — Electrical */}
      <TelemetryChart
        title="HV Battery SOC"
        measurementKey={HVBMS.minimumSoc}
        unit="%"
        colorIndex={2}
      />
      <TelemetryChart
        title="Brake Pressure"
        measurementKey={VCU.pressureBrakes}
        unit="bar"
        colorIndex={3}
      />

      {/* Row 3 — Motor phase currents */}
      <MultiSeriesChart
        title="DLIM — Phase Currents"
        series={DLIM_SERIES}
        unit="A"
      />
      <MultiSeriesChart
        title="LSM — Phase Currents"
        series={LSM_SERIES}
        unit="A"
      />
    </div>
  </div>
);

export default Charts;
