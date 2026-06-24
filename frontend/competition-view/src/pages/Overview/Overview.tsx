import { Button, Separator } from "@workspace/ui/components";
import { ChevronUp } from "@workspace/ui/icons";
import { useEffect, useRef, useState } from "react";
import {
  BCU,
  BLCU,
  HVBMS,
  HVBMS_CABINET,
  LCU,
  LVBMS,
  PCU,
  PCU_BOARD,
  VCU,
} from "../../constants/measurements";
import useMeasurement from "../../hooks/useMeasurement";
import { useStore } from "../../store/store";
import type { MessageKind } from "../../types/message";
import BoardCard from "../Boards/components/BoardCard";
import MultiSeriesChart, { type SeriesConfig } from "../Charts/components/MultiSeriesChart";
import TelemetryChart from "../Charts/components/TelemetryChart";
import MessageItem from "../Messages/components/MessageItem";

/* ─── Stable series configs ─────────────────────────────────────────────── */

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

/* ─── Compact metric tile ───────────────────────────────────────────────── */

interface MetricTileProps {
  label: string;
  value: string | undefined;
  unit?: string;
  valueClassName?: string;
}

const MetricTile = ({ label, value, unit, valueClassName = "" }: MetricTileProps) => (
  <div className="bg-card flex flex-col justify-center rounded-lg border px-3 py-2">
    <span className="text-muted-foreground text-[10px] font-medium leading-none tracking-widest uppercase">
      {label}
    </span>
    <span className={`text-foreground text-xl font-bold leading-tight tabular-nums ${valueClassName}`}>
      {value ?? "—"}
      {value !== undefined && unit && (
        <span className="text-muted-foreground ml-0.5 text-xs font-normal">{unit}</span>
      )}
    </span>
  </div>
);

/* ─── Messages panel ────────────────────────────────────────────────────── */

const ALL_KINDS: MessageKind[] = ["info", "warning", "error", "debug"];
const KIND_LABEL: Record<MessageKind, string> = { info: "Info", warning: "Warn", error: "Err", debug: "Dbg" };

const MessagesPanel = () => {
  const messages      = useStore((s) => s.messages);
  const clearMessages = useStore((s) => s.clearMessages);

  const [activeKinds, setActiveKinds] = useState<Set<MessageKind>>(new Set(ALL_KINDS));
  const [scrolledAway, setScrolledAway] = useState(false);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  const filtered = messages.filter((m) => activeKinds.has(m.kind));

  const toggleKind = (kind: MessageKind) =>
    setActiveKinds((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });

  useEffect(() => {
    if (filtered.length > prevLenRef.current && !scrolledAway) {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevLenRef.current = filtered.length;
  }, [filtered.length, scrolledAway]);

  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col rounded-xl border shadow-sm">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2">
        {ALL_KINDS.map((kind) => (
          <Button key={kind} size="sm" variant={activeKinds.has(kind) ? "default" : "outline"}
            onClick={() => toggleKind(kind)} className="h-6 rounded-full px-2 text-xs">
            {KIND_LABEL[kind]}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">{filtered.length}/{messages.length}</span>
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-3" />
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs"
            onClick={clearMessages} disabled={messages.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => setScrolledAway(e.currentTarget.scrollTop > 60)}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <p className="text-muted-foreground flex h-full items-center justify-center text-sm">No messages</p>
        ) : (
          filtered.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
        {scrolledAway && (
          <Button size="sm" variant="secondary"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 gap-1 px-2 py-1 text-xs shadow">
            <ChevronUp className="size-3" /> Latest
          </Button>
        )}
      </div>
    </div>
  );
};

/* ─── Dashboard ─────────────────────────────────────────────────────────── */

const Dashboard = () => {
  const speed        = useMeasurement(PCU.speed);
  const position     = useMeasurement(PCU.position);
  const acceleration = useMeasurement(PCU.acceleration);
  const soc          = useMeasurement(HVBMS.minimumSoc);
  const hvVoltage    = useMeasurement(HVBMS.voltageReading);
  const hvCurrent    = useMeasurement(HVBMS.currentReading);
  const tempMax      = useMeasurement(HVBMS.tempMax);
  const brakePsi     = useMeasurement(VCU.pressureBrakes);
  const highPsi      = useMeasurement(VCU.highPressure);

  const fmt = (v: ReturnType<typeof useMeasurement>, d = 1) =>
    v === undefined ? undefined : typeof v === "number" ? v.toFixed(d) : String(v);

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden p-3">

      {/* ── Left column: metrics (top) + charts (bottom) ─────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">

        {/* Metric tiles — 3×3 grid, one row per group */}
        <div className="grid shrink-0 grid-cols-3 gap-2">
          {/* Kinematic */}
          <MetricTile label="Speed"       value={fmt(speed)}           unit="km/h" />
          <MetricTile label="Position"    value={fmt(position)}        unit="m"    />
          <MetricTile label="Acceleration" value={fmt(acceleration, 2)} unit="m/s²" />
          {/* Electrical */}
          <MetricTile label="SOC"         value={fmt(soc)}             unit="%"
            valueClassName={typeof soc === "number" && soc < 20 ? "text-red-500" : ""} />
          <MetricTile label="HV Voltage"  value={fmt(hvVoltage)}       unit="V"    />
          <MetricTile label="HV Current"  value={fmt(hvCurrent)}       unit="A"    />
          {/* Pressure */}
          <MetricTile label="Pack Temp"   value={fmt(tempMax)}         unit="°C"
            valueClassName={typeof tempMax === "number" && tempMax > 55 ? "text-red-500" : ""} />
          <MetricTile label="Brake Pres." value={fmt(brakePsi)}        unit="bar"  />
          <MetricTile label="High Pres."  value={fmt(highPsi)}         unit="bar"  />
        </div>

        {/* Charts — 2 cols × 3 rows, each fills its grid cell */}
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2">
          <TelemetryChart title="Speed"           measurementKey={PCU.speed}          unit="km/h" colorIndex={0} />
          <TelemetryChart title="Position"        measurementKey={PCU.position}       unit="m"    colorIndex={1} />
          <TelemetryChart title="HV Battery SOC"  measurementKey={HVBMS.minimumSoc}   unit="%"    colorIndex={2} />
          <TelemetryChart title="Brake Pressure"  measurementKey={VCU.pressureBrakes} unit="bar"  colorIndex={3} />
          <MultiSeriesChart title="DLIM — Phase Currents" series={DLIM_SERIES} unit="A" />
          <MultiSeriesChart title="LSM — Phase Currents"  series={LSM_SERIES}  unit="A" />
        </div>

      </div>

      {/* ── Right column: boards (top) + messages (bottom) ───────────── */}
      <div className="flex w-[42%] min-h-0 flex-col gap-3">

        {/* Board state cards — 2-col grid */}
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <BoardCard
            name="VCU"
            stateMeasurementKey={VCU.generalState}
            stats={[
              { label: "Op. state",   measurementKey: VCU.operationalState              },
              { label: "Brake pres.", measurementKey: VCU.pressureBrakes, unit: "bar"   },
              { label: "High pres.",  measurementKey: VCU.highPressure,   unit: "bar"   },
            ]}
          />
          <BoardCard
            name="HVBMS"
            stateMeasurementKey={HVBMS.operationalState}
            stats={[
              { label: "Min SOC",  measurementKey: HVBMS.minimumSoc,     unit: "%"  },
              { label: "Voltage",  measurementKey: HVBMS.voltageReading, unit: "V"  },
              { label: "Current",  measurementKey: HVBMS.currentReading, unit: "A"  },
              { label: "Temp max", measurementKey: HVBMS.tempMax,        unit: "°C" },
            ]}
          />
          <BoardCard
            name="HVBMS-Cabinet"
            stateMeasurementKey={HVBMS_CABINET.contactorsState}
            stats={[
              { label: "Bus voltage", measurementKey: HVBMS_CABINET.busVoltage,            unit: "V" },
              { label: "Supercaps",   measurementKey: HVBMS_CABINET.totalSupercapsVoltage, unit: "V" },
              { label: "SDC",         measurementKey: HVBMS_CABINET.sdcGood                          },
            ]}
          />
          <BoardCard
            name="PCU"
            stateMeasurementKey={PCU_BOARD.generalState}
            stats={[
              { label: "Op. state",    measurementKey: PCU_BOARD.operatingState           },
              { label: "Peak current", measurementKey: PCU_BOARD.peakCurrent,  unit: "A"  },
            ]}
          />
          <BoardCard
            name="BCU"
            stateMeasurementKey={BCU.generalState}
            stats={[
              { label: "Op. state", measurementKey: BCU.operationalState                          },
              { label: "Phase U",   measurementKey: BCU.averageCurrentU, unit: "A", decimals: 2   },
              { label: "Phase V",   measurementKey: BCU.averageCurrentV, unit: "A", decimals: 2   },
            ]}
          />
          <BoardCard
            name="LCU"
            stateMeasurementKey={LCU.generalState}
            stats={[
              { label: "Position Y", measurementKey: LCU.positionY, unit: "mm", decimals: 2 },
              { label: "Position Z", measurementKey: LCU.positionZ, unit: "mm", decimals: 2 },
            ]}
          />
          <BoardCard
            name="LVBMS"
            stateMeasurementKey={LVBMS.generalState}
            stats={[
              { label: "SOC",     measurementKey: LVBMS.soc,          unit: "%", decimals: 0 },
              { label: "Voltage", measurementKey: LVBMS.totalVoltage, unit: "V"              },
            ]}
          />
          <BoardCard name="BLCU" stateMeasurementKey={BLCU.state} />
        </div>

        {/* Messages — fills the remaining height */}
        <MessagesPanel />

      </div>

    </div>
  );
};

export default Dashboard;
