import { HVSCU, PCU, VCU } from "../../constants/measurements";
import TelemetryChart from "./components/TelemetryChart";

/**
 * Real-time telemetry charts page.
 *
 * Shows four fixed competition-critical series:
 *   Speed · Position · HV Battery SOC · Brake Pressure
 *
 * Each chart accumulates a rolling 500-point history and supports
 * click-drag zoom with double-click to reset.
 */
const Charts = () => (
  <div className="flex h-full flex-col gap-4 overflow-auto p-4">
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TelemetryChart
        title="Speed"
        measurementKey={PCU.speed}
        unit="m/s"
        colorIndex={0}
      />
      <TelemetryChart
        title="Position"
        measurementKey={PCU.position}
        unit="m"
        colorIndex={1}
      />
      <TelemetryChart
        title="HV Battery SOC"
        measurementKey={HVSCU.minimumSoc}
        unit="%"
        colorIndex={2}
      />
      <TelemetryChart
        title="Brake Pressure"
        measurementKey={VCU.pressureBrakes}
        unit="bar"
        colorIndex={3}
      />
    </div>
  </div>
);

export default Charts;
