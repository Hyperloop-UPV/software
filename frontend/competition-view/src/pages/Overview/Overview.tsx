import { HVSCU, PCU, VCU } from "../../constants/measurements";
import useMeasurement from "../../hooks/useMeasurement";
import BrakeIndicator from "./components/BrakeIndicator";
import MetricCard from "./components/MetricCard";
import OrdersPanel from "./components/OrdersPanel";
import RecentMessages from "./components/RecentMessages";
import VehicleStateBanner from "./components/VehicleStateBanner";

/**
 * Main competition dashboard.
 *
 * Layout:
 *   - Vehicle state banner (full width, colour-coded)
 *   - Row 1: Brake indicator + Speed + Position + SOC
 *   - Row 2: HV Voltage + HV Current + Pack Temp Max + Brake Pressure
 *   - Row 3: High Pressure + Capsule Pressure + Acceleration
 *   - Quick orders panel
 *   - Recent messages
 */
const Overview = () => {
  const speed        = useMeasurement(PCU.speed);
  const position     = useMeasurement(PCU.position);
  const acceleration = useMeasurement(PCU.acceleration);
  const soc          = useMeasurement(HVSCU.minimumSoc);
  const hvVoltage    = useMeasurement(HVSCU.voltageReading);
  const hvCurrent    = useMeasurement(HVSCU.currentReading);
  const tempMax      = useMeasurement(HVSCU.tempMax);
  const brakePsi     = useMeasurement(VCU.pressureBrakes);
  const highPsi      = useMeasurement(VCU.highPressure);
  const capsulePsi   = useMeasurement(VCU.pressureCapsule);

  const fmt = (v: ReturnType<typeof useMeasurement>, decimals = 1): string | undefined => {
    if (v === undefined) return undefined;
    if (typeof v === "number") return v.toFixed(decimals);
    return String(v);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {/* Vehicle state banner */}
      <VehicleStateBanner />

      {/* Row 1 — Brake indicator + kinematic metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <BrakeIndicator />
        </div>
        <MetricCard label="Speed"    value={fmt(speed)}    unit="m/s" />
        <MetricCard label="Position" value={fmt(position)} unit="m"   />
        <MetricCard
          label="HV Battery SOC"
          value={fmt(soc)}
          unit="%"
          valueClassName={typeof soc === "number" && soc < 20 ? "text-red-500" : ""}
        />
      </div>

      {/* Row 2 — Electrical & thermal */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="HV Voltage" value={fmt(hvVoltage)} unit="V" />
        <MetricCard label="HV Current" value={fmt(hvCurrent)} unit="A" />
        <MetricCard
          label="Pack Temp Max"
          value={fmt(tempMax)}
          unit="°C"
          valueClassName={typeof tempMax === "number" && tempMax > 55 ? "text-red-500" : ""}
        />
        <MetricCard label="Brake Pressure" value={fmt(brakePsi)} unit="bar" />
      </div>

      {/* Row 3 — Pneumatics + acceleration */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="High Pressure"    value={fmt(highPsi)}    unit="bar"  />
        <MetricCard label="Capsule Pressure" value={fmt(capsulePsi)} unit="bar"  />
        <MetricCard label="Acceleration"     value={fmt(acceleration, 2)} unit="m/s²" />
      </div>

      {/* Quick orders */}
      <OrdersPanel />

      {/* Recent messages */}
      <RecentMessages />
    </div>
  );
};

export default Overview;
