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
 *   - Vehicle state banner (full width)
 *   - Brake indicator + primary metrics row
 *   - Secondary metrics row (pressures, temperatures, electrical)
 *   - Recent messages panel
 */
const Overview = () => {
  const speed       = useMeasurement(PCU.speed);
  const position    = useMeasurement(PCU.position);
  const soc         = useMeasurement(HVSCU.minimumSoc);
  const hvVoltage   = useMeasurement(HVSCU.voltageReading);
  const hvCurrent   = useMeasurement(HVSCU.currentReading);
  const tempMax     = useMeasurement(HVSCU.tempMax);
  const brakePsi    = useMeasurement(VCU.pressureBrakes);
  const highPsi     = useMeasurement(VCU.highPressure);

  const formatNum = (v: ReturnType<typeof useMeasurement>, decimals = 1) =>
    typeof v === "number" ? v.toFixed(decimals) : v;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {/* Vehicle state banner */}
      <VehicleStateBanner />

      {/* Brake indicator + primary metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <BrakeIndicator />
        </div>

        <MetricCard
          label="Speed"
          value={formatNum(speed)}
          unit="m/s"
        />
        <MetricCard
          label="Position"
          value={formatNum(position)}
          unit="m"
        />
        <MetricCard
          label="HV Battery SOC"
          value={formatNum(soc)}
          unit="%"
          valueClassName={
            typeof soc === "number" && soc < 20 ? "text-red-500" : ""
          }
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="HV Voltage"
          value={formatNum(hvVoltage)}
          unit="V"
        />
        <MetricCard
          label="HV Current"
          value={formatNum(hvCurrent)}
          unit="A"
        />
        <MetricCard
          label="Pack Temp Max"
          value={formatNum(tempMax)}
          unit="°C"
          valueClassName={
            typeof tempMax === "number" && tempMax > 55 ? "text-red-500" : ""
          }
        />
        <MetricCard
          label="Brake Pressure"
          value={formatNum(brakePsi)}
          unit="bar"
        />
      </div>

      {/* Quick orders */}
      <OrdersPanel />

      {/* Recent messages */}
      <RecentMessages />
    </div>
  );
};

export default Overview;
