import { Button } from "@hyperloop-upv/frontend-kit/components";
import { ChevronDown, MessageSquare } from "@hyperloop-upv/frontend-kit/icons";
import {
  BatteryFull,
  Gauge,
  type LucideIcon,
  MoveHorizontal,
  MoveVertical,
  Shield,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatAxisValue } from "../../constants/chartConfig";
import {
  BOARDS,
  DC_BUS_V_RANGE,
  HV_CURRENT_RANGE,
  HVBMS,
  LCU,
  LEV_CURRENT_RANGE,
  PACK_V_RANGE,
  PCU,
  PROP_CURRENT_RANGE,
  SPEED_RANGE,
  TEMP_RANGE,
} from "../../constants/measurements";
import useMeasurement from "../../hooks/useMeasurement";
import { useIsStale, useStaleFlags } from "../../hooks/useIsStale";
import { STALE_TEXT_CLASS } from "../../lib/freshness";
import { useStore } from "../../store/store";
import MultiSeriesChart, { type SeriesConfig } from "../Charts/components/MultiSeriesChart";
import TelemetryChart from "../Charts/components/TelemetryChart";
import MessageItem from "../Messages/components/MessageItem";
import BoardsOverviewCard from "./components/BoardsOverviewCard";
import OrdersPanel from "./components/OrdersPanel";
import TrackProgress from "./components/TrackProgress";

/* ─── Stable series configs ─────────────────────────────────────────────── */

const DLIM_SERIES: SeriesConfig[] = [
  { board: BOARDS.PCU, measurementKey: PCU.motorCurrentU, label: "U", colorIndex: 0 },
  { board: BOARDS.PCU, measurementKey: PCU.motorCurrentV, label: "V", colorIndex: 1 },
  { board: BOARDS.PCU, measurementKey: PCU.motorCurrentW, label: "W", colorIndex: 2 },
];

const VERT_AIRGAP_SERIES: SeriesConfig[] = [
  { board: BOARDS.LCU, measurementKey: LCU.verticalAirgap1, label: "1", colorIndex: 0 },
  { board: BOARDS.LCU, measurementKey: LCU.verticalAirgap2, label: "2", colorIndex: 1 },
  { board: BOARDS.LCU, measurementKey: LCU.verticalAirgap3, label: "3", colorIndex: 2 },
  { board: BOARDS.LCU, measurementKey: LCU.verticalAirgap4, label: "4", colorIndex: 3 },
];

const LAT_AIRGAP_SERIES: SeriesConfig[] = [
  { board: BOARDS.LCU, measurementKey: LCU.horizontalAirgap1, label: "1", colorIndex: 0 },
  { board: BOARDS.LCU, measurementKey: LCU.horizontalAirgap2, label: "2", colorIndex: 1 },
  { board: BOARDS.LCU, measurementKey: LCU.horizontalAirgap3, label: "3", colorIndex: 2 },
  { board: BOARDS.LCU, measurementKey: LCU.horizontalAirgap4, label: "4", colorIndex: 3 },
];

const HEMS_SERIES: SeriesConfig[] = [
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentHEMS1, label: "H1", colorIndex: 0 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentHEMS2, label: "H2", colorIndex: 1 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentHEMS3, label: "H3", colorIndex: 2 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentHEMS4, label: "H4", colorIndex: 3 },
];

const EMS_SERIES: SeriesConfig[] = [
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentEMS1, label: "E1", colorIndex: 0 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentEMS2, label: "E2", colorIndex: 1 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentEMS3, label: "E3", colorIndex: 2 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentEMS4, label: "E4", colorIndex: 3 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentEMS5, label: "E5", colorIndex: 4 },
  { board: BOARDS.LCU, measurementKey: LCU.coilCurrentEMS6, label: "E6", colorIndex: 5 },
];

/* ─── Helpers ───────────────────────────────────────────────────────────── */

/**
 * Formats a telemetry number for display, capped to `decimals` places.
 * Garbage/misdecoded samples can come through as huge magnitudes (a
 * float64 reinterpreted from bad bytes can reach ~1e308) — those fall
 * back to the same compact/exponential formatting used on chart axes
 * instead of printing dozens of digits.
 */
const fmtNum = (v: number | boolean | string | undefined, decimals = 1) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return formatAxisValue(v);
  return v.toFixed(decimals);
};

/* ─── Battery card ──────────────────────────────────────────────────────── */

interface BatteryRow {
  label: string;
  value: string | undefined;
  unit?: string;
  warn?: boolean;
  /** Data stopped arriving — value is rendered in yellow. */
  stale?: boolean;
  /** Expected operating interval [min, max], shown muted next to the value. */
  range?: readonly [number, number];
}

interface BatteryCardProps {
  title: string;
  icon: LucideIcon;
  soc: number | undefined;
  socStale?: boolean;
  rows: BatteryRow[];
}

/** SOC-level colouring: red below 20 %, amber below 40 %, green otherwise. */
const socColors = (soc: number | undefined) =>
  typeof soc !== "number" ? { bar: "bg-muted-foreground/20", text: "" }
  : soc < 20              ? { bar: "bg-red-500",   text: "text-red-500" }
  : soc < 40              ? { bar: "bg-amber-500", text: "text-amber-500" }
  :                         { bar: "bg-green-500", text: "" };

const BatteryCard = ({ title, icon: Icon, soc, socStale, rows }: BatteryCardProps) => {
  const socPct = typeof soc === "number" ? Math.min(100, Math.max(0, soc)) : 0;
  const { bar, text } = socColors(soc);

  return (
    <div className="bg-card flex flex-col rounded-xl border p-2.5 gap-1.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="text-muted-foreground size-4" />
          {title}
        </span>
        <span className={`text-base font-bold tabular-nums ${socStale ? STALE_TEXT_CLASS : text}`}>
          {fmtNum(soc, 0) ?? "—"}
          <span className="text-muted-foreground ml-0.5 text-xs font-normal">%</span>
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-[width] ${bar}`} style={{ width: `${socPct}%` }} />
      </div>

      <div className="flex flex-col gap-0.5">
        {rows.map(({ label, value, unit, warn, stale, range }) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
            <span className={`text-sm font-medium tabular-nums ${stale ? STALE_TEXT_CLASS : warn ? "text-red-500" : "text-foreground"}`}>
              {value ?? "—"}
              {range && (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  [{range[0]}, {range[1]}]
                </span>
              )}
              {(value !== undefined || range) && unit && (
                <span className="text-muted-foreground ml-0.5 text-xs font-normal">{unit}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Kinematics card ───────────────────────────────────────────────────── */

const KinematicsCard = () => {
  const speed    = useMeasurement(BOARDS.PCU, PCU.speed);
  const position = useMeasurement(BOARDS.PCU, PCU.position);

  const speedStale = useIsStale(BOARDS.PCU, PCU.speed);
  const posStale   = useIsStale(BOARDS.PCU, PCU.position);

  const rows = [
    { label: "Position",     value: fmtNum(position),        unit: "m",   stale: posStale  },
  ];

  return (
    <div className="bg-card flex flex-col rounded-xl border p-2.5 gap-1.5 shadow-sm">
      {/* Speed sits beside the title (like the battery card's SOC) to keep the card short. */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Gauge className="text-muted-foreground size-4" />
          Kinematics
        </span>
        <span className={`text-xl font-bold leading-none tabular-nums ${speedStale ? STALE_TEXT_CLASS : ""}`}>
          {fmtNum(speed, 0) ?? "—"}
          <span className="text-muted-foreground ml-1 text-xs font-normal">km/h</span>
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {rows.map(({ label, value, unit, stale }) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
            <span className={`text-sm font-medium tabular-nums ${stale ? STALE_TEXT_CLASS : "text-foreground"}`}>
              {value ?? "—"}
              {value !== undefined && unit && (
                <span className="text-muted-foreground ml-0.5 text-xs font-normal">{unit}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Safety card ───────────────────────────────────────────────────────── */

interface SafeRow { label: string; text: string; color: string }

/** Measurement ids backing the Safety card rows (stable for useStaleFlags). */
const SAFETY_STALE_IDS = [
  HVBMS.sdcStatus,
  HVBMS.contactorHigh,
  HVBMS.contactorLow,
  HVBMS.imdOk,
  HVBMS.operationalState,
] as const;

const SafetyCard = () => {
  const sdcStatus     = useMeasurement(BOARDS.HVBMS, HVBMS.sdcStatus);
  const contactorHigh = useMeasurement(BOARDS.HVBMS, HVBMS.contactorHigh);
  const contactorLow  = useMeasurement(BOARDS.HVBMS, HVBMS.contactorLow);
  const contactors    = contactorHigh === undefined || contactorLow === undefined
    ? undefined
    : contactorHigh === true && contactorLow === true;
  const imd        = useMeasurement(BOARDS.HVBMS, HVBMS.imdOk);
  const hvBmsState = useMeasurement(BOARDS.HVBMS, HVBMS.operationalState);

  const [sdcStale, ctHighStale, ctLowStale, imdStale, stateStale] =
    useStaleFlags(BOARDS.HVBMS, SAFETY_STALE_IDS);

  const rows: SafeRow[] = [
    {
      label: "SDC",
      text:  sdcStatus === undefined ? "—" : String(sdcStatus),
      color: sdcStale ? STALE_TEXT_CLASS : sdcStatus === "ENGAGED" ? "text-green-500" : sdcStatus === "DISENGAGED" ? "text-red-500" : "text-muted-foreground",
    },
    {
      label: "Contactors",
      text:  contactors === true ? "CLOSED" : contactors === false ? "OPEN" : "—",
      color: ctHighStale || ctLowStale ? STALE_TEXT_CLASS : contactors === true ? "text-green-500" : contactors === false ? "text-amber-500" : "text-muted-foreground",
    },
    {
      label: "IMD",
      text:  imd === true ? "OK" : imd === false ? "FAULT" : "—",
      color: imdStale ? STALE_TEXT_CLASS : imd === true ? "text-green-500" : imd === false ? "text-red-500" : "text-muted-foreground",
    },
    {
      label: "HV BMS",
      text:  hvBmsState === undefined ? "—" : String(hvBmsState),
      color: stateStale ? STALE_TEXT_CLASS : hvBmsState === "OPERATIONAL" ? "text-green-500" : "text-foreground",
    },
  ];

  return (
    <div className="bg-card flex flex-col rounded-xl border p-2.5 gap-1.5 shadow-sm">
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <Shield className="text-muted-foreground size-4" />
        Safety
      </span>
      <div className="flex flex-col gap-1">
        {rows.map(({ label, text, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
            <span className={`text-sm font-semibold ${color}`}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Messages panel ────────────────────────────────────────────────────── */

const MessagesPanel = () => {
  const messages      = useStore((s) => s.messages);
  const clearMessages = useStore((s) => s.clearMessages);

  const [scrolledAway, setScrolledAway] = useState(false);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  const scrollToLatest = (behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    if (messages.length > prevLenRef.current && !scrolledAway) {
      scrollToLatest();
    }
    prevLenRef.current = messages.length;
  }, [messages.length, scrolledAway]);

  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col rounded-xl border shadow-sm">
      <div className="flex shrink-0 items-center gap-1.5 border-b px-3 py-2">
        <span className="text-muted-foreground flex flex-1 items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
          <MessageSquare className="size-3.5" />
          Messages
        </span>
        <span className="text-muted-foreground text-xs">{messages.length}</span>
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs"
          onClick={clearMessages} disabled={messages.length === 0}>
          Clear
        </Button>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setScrolledAway(el.scrollHeight - el.scrollTop - el.clientHeight > 60);
        }}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground flex h-full items-center justify-center text-sm">No messages</p>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} message={msg} size="sm" />)
        )}
        {scrolledAway && (
          <Button size="sm" variant="secondary"
            onClick={() => scrollToLatest("smooth")}
            className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 gap-1 px-2 py-1 text-xs shadow">
            <ChevronDown className="size-3" /> Latest
          </Button>
        )}
      </div>
    </div>
  );
};

/* ─── HV battery card ───────────────────────────────────────────────────── */

/**
 * Leaf component so the HVBMS subscriptions re-render only this card —
 * keeping them in Dashboard would re-render the whole page tree on every
 * telemetry packet.
 */
/** Measurement ids backing the HV battery rows (stable for useStaleFlags). */
const HV_BATTERY_STALE_IDS = [
  HVBMS.soc,
  HVBMS.batteriesVoltage,
  HVBMS.currentReading,
  HVBMS.voltageReading,
  HVBMS.tempMin,
  HVBMS.tempMax,
] as const;

const HvBatteryCard = () => {
  const hvSoc     = useMeasurement(BOARDS.HVBMS, HVBMS.soc);
  const hvVoltage = useMeasurement(BOARDS.HVBMS, HVBMS.batteriesVoltage);
  const hvCurrent = useMeasurement(BOARDS.HVBMS, HVBMS.currentReading);
  const hvVSensor = useMeasurement(BOARDS.HVBMS, HVBMS.voltageReading);
  const hvTempMin = useMeasurement(BOARDS.HVBMS,HVBMS.tempMin);
  const hvTempMax = useMeasurement(BOARDS.HVBMS,HVBMS.tempMax);

  const [socStale, vStale, iStale, dcStale,tempMinStale,
    tempMaxStale] = useStaleFlags(BOARDS.HVBMS, HV_BATTERY_STALE_IDS);

  return (
    <BatteryCard
      title="HV Battery"
      icon={BatteryFull}
      soc={typeof hvSoc === "number" ? hvSoc : undefined}
      socStale={socStale}
      rows={[
        { label: "Pack V",    value: fmtNum(hvVoltage), unit: "V", stale: vStale,  range: PACK_V_RANGE   },
        { label: "Current",   value: fmtNum(hvCurrent), unit: "A", stale: iStale,  range: HV_CURRENT_RANGE },
        { label: "DC Link",   value: fmtNum(hvVSensor), unit: "V", stale: dcStale, range: DC_BUS_V_RANGE },
        { label: "T max",   value: fmtNum(hvTempMax), unit: "ºC", stale: tempMaxStale, range: TEMP_RANGE},
        { label: "T min",   value: fmtNum(hvTempMin), unit: "ºC", stale: tempMinStale, range: TEMP_RANGE},
      ]}
    />
  );
};

/* ─── Dashboard ─────────────────────────────────────────────────────────── */

const Dashboard = () => {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden p-2">

      <TrackProgress />

      <div className="flex min-h-0 flex-1 gap-2">

        {/* ── Left column ────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">

          {/* Summary cards row */}
          <div className="grid shrink-0 grid-cols-3 gap-2">
            <HvBatteryCard />
            <KinematicsCard />
            <SafetyCard />
          </div>

          {/* Charts — 2 cols × 3 rows */}
          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2">
            <MultiSeriesChart title="DLIM — Phase Currents"  icon={Zap}           series={DLIM_SERIES}       unit={`[${PROP_CURRENT_RANGE[0]}, ${PROP_CURRENT_RANGE[1]}] A`} />
            <TelemetryChart   title="Speed"                  icon={Gauge}         board={BOARDS.PCU}          measurementKey={PCU.speed}    unit={`[${SPEED_RANGE[0]}, ${SPEED_RANGE[1]}] km/h`} colorIndex={0} />
            <MultiSeriesChart title="Vertical Airgaps"       icon={MoveVertical}  series={VERT_AIRGAP_SERIES} unit="mm" />
            <MultiSeriesChart title="Lateral Airgaps"        icon={MoveHorizontal} series={LAT_AIRGAP_SERIES} unit="mm" />
            <MultiSeriesChart title="HEMS — Coil Currents"   icon={Zap}           series={HEMS_SERIES}        unit={`[${LEV_CURRENT_RANGE[0]}, ${LEV_CURRENT_RANGE[1]}] A`} />
            <MultiSeriesChart title="EMS — Coil Currents"    icon={Zap}           series={EMS_SERIES}         unit={`[${LEV_CURRENT_RANGE[0]}, ${LEV_CURRENT_RANGE[1]}] A`} />
          </div>

        </div>

        {/* ── Right column ───────────────────────────────────────────── */}
        <div className="flex w-[35%] min-h-0 flex-col gap-2">

          <BoardsOverviewCard />

          <OrdersPanel />

          <MessagesPanel />

        </div>

      </div>

    </div>
  );
};

export default Dashboard;
