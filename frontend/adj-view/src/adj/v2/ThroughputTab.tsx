import {
  Button,
  Checkbox,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components";
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, Pencil } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { Fragment, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BoardMeta } from "./AdjViewerTabs";
import { ThroughputHelp } from "./ThroughputHelp";
import {
  boardTotals,
  computeBoardThroughput,
  COUNTED_LABEL,
  DEFAULT_TRAFFIC_OPTIONS,
  ETH_HEADER_BYTES,
  ETH_MIN_PAYLOAD_BYTES,
  formatBitrate,
  IPV4_HEADER_BYTES,
  keepAliveFlows,
  PACKET_ID_BYTES,
  PERIOD_UNITS,
  periodSeconds,
  type BoardThroughput,
  type PeriodOverride,
  type BoardTotals,
  type CountAs,
  type Direction,
  type TrafficFlow,
  type TrafficOptions,
} from "./throughput";

// What-if periods by board then packet id. Only committed, valid values are
// stored; drafts live in the cell editor.
type PeriodOverridesByBoard = Record<string, Record<number, PeriodOverride>>;

type OnPeriodChange = (f: TrafficFlow, override: PeriodOverride | null) => void;

// Native number spinners ignore the theme and overlap right-aligned values in
// these narrow inputs, so StepperInput hides them and draws its own.
const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// Steps by 1, never below 0; rounds away float noise (0.1 + 1 = 1.1, not 1.1000000000000001).
const stepValue = (value: string, delta: number) => String(+Math.max(0, (Number(value) || 0) + delta).toPrecision(12));

function StepperInput({
  value,
  onValueChange,
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (v: string) => void;
}) {
  const arrow =
    "text-muted-foreground hover:bg-muted hover:text-foreground flex h-1/2 w-full items-center justify-center transition-colors disabled:pointer-events-none";
  return (
    <div className="relative shrink-0">
      <Input
        {...props}
        type="number"
        min={0}
        step="any"
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn("pr-6", NO_SPINNER, className)}
      />
      {/* Not tab stops: the input's own arrow keys already step the value. */}
      <div className="absolute inset-y-px right-px flex w-5 flex-col overflow-hidden rounded-r-[5px] border-l">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Increase"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onValueChange(stepValue(value, 1))}
          className={arrow}
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Decrease"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onValueChange(stepValue(value, -1))}
          className={cn(arrow, "border-t")}
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ─── series colors ───────────────────────────────────────────────────────────

// Fixed slot per board (alphabetical order from extractBoards), never by rank,
// so toggling options or boards never repaints the survivors. Past the palette
// size, boards fold into a single "Other" segment.
const SERIES_SLOTS = 8;
const seriesColor = (index: number) =>
  index < SERIES_SLOTS ? `var(--series-${index + 1})` : "var(--series-other)";

// Keep-alive is drawn as a 45° texture of the board's own color, so the board
// keeps its identity and UDP vs keep-alive needs no extra hue.
const keepAliveFill = (color: string): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 3px, color-mix(in oklab, ${color} 30%, transparent) 3px 6px)`,
});

const DIRECTION_LABEL: Record<Direction, string> = {
  up: "Board → backend",
  down: "Backend → board",
};

const pctOf = (bps: number, capacity: number | null) => {
  if (!capacity) return "—";
  const p = (bps / capacity) * 100;
  if (p === 0) return "0%";
  return p < 0.01 ? "<0.01%" : `${p < 1 ? p.toFixed(2) : p.toFixed(1)}%`;
};

// ─── calculation breakdown ───────────────────────────────────────────────────

function Step({ label, value, note, total }: { label: ReactNode; value: ReactNode; note?: ReactNode; total?: boolean }) {
  return (
    <div className={cn("flex items-baseline gap-2 py-0.5", total && "mt-0.5 border-t pt-1 font-semibold")}>
      <span className={cn("min-w-0 flex-1 truncate", !total && "text-muted-foreground")}>
        {label}
        {note && <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">{note}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

// The three steps are a real sequence (payload → frame → rate), hence the numbers.
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="bg-background min-w-0 rounded-md border p-3">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold">
        <span className="bg-primary/15 text-primary grid size-5 place-items-center rounded-full text-[11px]">{n}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

function FlowBreakdown({ f }: { f: TrafficFlow }) {
  const { wire } = f;
  const rate = `${f.rateHz.toFixed(2)} Hz`;
  const efficiency = (f.payloadBytes / f.wireBytes) * 100;
  const wireshark = wire.countAs === "wireshark";
  const excluded = wireshark ? "not in Wireshark" : "not counted";
  const counted = COUNTED_LABEL[wire.countAs];
  const paddingNote =
    wireshark && f.direction === "down"
      ? "added by the NIC after capture"
      : wire.padding > 0
        ? `up to the ${ETH_MIN_PAYLOAD_BYTES} B minimum`
        : `already ${ETH_MIN_PAYLOAD_BYTES} B or more`;

  return (
    <div className="grid grid-cols-1 gap-2 text-xs xl:grid-cols-3">
      <Section n={1} title={`Payload (${f.transport} data)`}>
        {f.hasPacketId ? (
          <>
            <div className="max-h-[12rem] overflow-y-auto pr-1">
              <Step label="Packet ID" note="uint16" value={`${PACKET_ID_BYTES} B`} />
              {f.fields.map((field) => (
                <Step key={field.id} label={field.id} note={field.type} value={`${field.bytes} B`} />
              ))}
            </div>
            <Step
              total
              label={
                f.fields.length > 0
                  ? `Payload, ID + ${f.fields.length} variable${f.fields.length === 1 ? "" : "s"}`
                  : "Payload, ID only"
              }
              value={`${f.payloadBytes} B`}
            />
          </>
        ) : (
          <Step total label="Pure ACK, no payload" value="0 B" />
        )}
      </Section>

      <Section n={2} title={wireshark ? "Bytes per frame in Wireshark" : "Bytes on the wire per frame"}>
        <Step label="Payload" value={`${wire.payload} B`} />
        <Step label={`+ ${wire.transport} header`} note={wire.transport === "TCP" ? "no options" : undefined} value={`${wire.transportHeader} B`} />
        <Step label="+ IPv4 header" value={`${IPV4_HEADER_BYTES} B`} />
        <Step total label="= IP packet" value={`${wire.ipPacket} B`} />
        <Step
          label="+ Ethernet padding"
          note={paddingNote}
          value={`${wire.padding} B`}
        />
        <Step label="+ Ethernet header" value={`${ETH_HEADER_BYTES} B`} />
        <Step label="+ FCS (CRC)" note={wire.fcs === 0 ? excluded : undefined} value={`${wire.fcs} B`} />
        <Step total label="= Ethernet frame" value={`${wire.frame} B`} />
        <Step label="+ Preamble and SFD" note={wire.preambleSfd === 0 ? excluded : undefined} value={`${wire.preambleSfd} B`} />
        <Step label="+ Inter-frame gap" note={wire.interFrameGap === 0 ? excluded : undefined} value={`${wire.interFrameGap} B`} />
        <Step total label={`= ${counted}`} value={`${wire.total} B`} />
      </Section>

      <Section n={3} title="Rate and throughput">
        <Step
          label="Period"
          note={f.adjPeriod !== undefined ? `edited, ADJ has ${f.adjPeriod} ${f.adjPeriodUnit}` : undefined}
          value={`${f.period} ${f.periodUnit} = ${+f.periodSeconds.toPrecision(6)} s`}
        />
        <Step label="Rate = 1 / period" value={rate} />
        <Step total label="Payload" value={formatBitrate(f.payloadBps)} />
        <div className="text-muted-foreground pb-1 text-right tabular-nums">
          {f.payloadBytes} B × 8 bit × {rate}
        </div>
        <Step total label={counted} value={formatBitrate(f.wireBps)} />
        <div className="text-muted-foreground pb-1 text-right tabular-nums">
          {f.wireBytes} B × 8 bit × {rate}
        </div>
        <Step label="Efficiency" note={`payload ÷ ${counted.toLowerCase()}`} value={`${efficiency.toFixed(1)}%`} />
      </Section>
    </div>
  );
}

// ─── flow table ──────────────────────────────────────────────────────────────

// Shows the period as text; a click opens a value + unit editor. Enter or
// leaving the editor applies a valid draft, Escape discards it.
function PeriodCell({ f, onChange }: { f: TrafficFlow; onChange: OnPeriodChange }) {
  const [draft, setDraft] = useState<{ value: string; unit: string } | null>(null);
  // Unmounting the focused editor fires a blur; this stops it from applying a
  // draft that Enter already applied or Escape discarded.
  const closing = useRef(false);

  const modified = f.adjPeriod !== undefined;
  const adjLabel = modified ? `${f.adjPeriod} ${f.adjPeriodUnit}` : `${f.period} ${f.periodUnit}`;
  const valid = draft !== null && draft.value.trim() !== "" && Number(draft.value) > 0;

  const open = () => {
    closing.current = false;
    setDraft({ value: String(f.period), unit: f.periodUnit });
  };
  const close = (apply: boolean) => {
    if (closing.current) return;
    closing.current = true;
    if (apply && valid) onChange(f, { value: Number(draft.value), unit: draft.unit });
    setDraft(null);
  };

  if (draft) {
    return (
      <td className="px-3 py-1 text-right" onClick={(e) => e.stopPropagation()}>
        <div
          className="flex items-center justify-end gap-1"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) close(true);
            if (e.key === "Escape") close(false);
          }}
        >
          <StepperInput
            autoFocus
            value={draft.value}
            aria-invalid={!valid}
            aria-label={`Period of ${f.name}`}
            onFocus={(e) => e.target.select()}
            onValueChange={(v) => setDraft({ ...draft, value: v })}
            className="h-7 w-[5rem] pl-2 text-right text-xs tabular-nums"
          />
          <select
            value={draft.unit}
            aria-label={`Period unit of ${f.name}`}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            className="border-input bg-background h-7 rounded-md border px-1 text-xs"
          >
            {PERIOD_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </td>
    );
  }

  return (
    <td className="px-3 py-1 text-right" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1.5">
        {modified && (
          <button
            type="button"
            onClick={() => onChange(f, null)}
            title={`Back to the ADJ value (${adjLabel})`}
            className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-2"
          >
            reset
          </button>
        )}
        <button
          type="button"
          onClick={open}
          aria-label={`Change period of ${f.name}`}
          title={modified ? `Edited for the calculation only. ADJ has ${adjLabel}. Click to change.` : "Click to try another period"}
          className={cn(
            "group hover:bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums",
            modified && "bg-primary/10 text-primary hover:bg-primary/15 font-semibold",
          )}
        >
          {f.period} {f.periodUnit}
          <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
        </button>
      </div>
    </td>
  );
}

function FlowTable({
  title,
  flows,
  onPeriodChange,
  selectedKey,
  onSelectFlow,
}: {
  title: string;
  flows: TrafficFlow[];
  onPeriodChange?: OnPeriodChange;
  selectedKey?: string;
  onSelectFlow?: (flow: TrafficFlow | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const directions = (["up", "down"] as const).filter((d) => flows.some((f) => f.direction === d));

  return (
    <div className="bg-background overflow-hidden rounded-md border">
      <div className="flex items-baseline gap-2 border-b px-3 py-2">
        <h4 className="text-xs font-semibold">{title}</h4>
        <span className="text-muted-foreground text-[11px]">
          {flows.length} {flows.length === 1 ? "flow" : "flows"}, click one to see its calculation
          {onSelectFlow && " and highlight its bandwidth"}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-1.5 text-left font-medium">Flow</th>
            <th className="px-3 py-1.5 text-left font-medium">Direction</th>
            <th className="px-3 py-1.5 text-right font-medium">Period</th>
            <th className="px-3 py-1.5 text-right font-medium">Rate</th>
            <th className="px-3 py-1.5 text-right font-medium">Payload</th>
            <th className="px-3 py-1.5 text-right font-medium">{COUNTED_LABEL[flows[0]?.wire.countAs ?? "wire"]}</th>
            <th className="px-3 py-1.5 text-right font-medium">Throughput</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {flows.map((f) => {
            const isOpen = open === f.key;
            const isSelected = selectedKey === f.key;
            const toggle = () => {
              setOpen(isOpen ? null : f.key);
              onSelectFlow?.(isSelected ? null : f);
            };
            return (
              <Fragment key={f.key}>
                <tr
                  onClick={toggle}
                  className={cn("hover:bg-muted/40 cursor-pointer border-b last:border-0", isOpen && "bg-muted/40", isSelected && "bg-primary/10")}
                >
                  <td className="px-3 py-1.5 font-medium">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-pressed={onSelectFlow ? isSelected : undefined}
                      onClick={(e) => { e.stopPropagation(); toggle(); }}
                      className="inline-flex items-center gap-1.5 text-left"
                    >
                      <ChevronRight
                        className={cn("text-muted-foreground size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")}
                      />
                      {f.name}
                      {f.id != null && <span className="text-muted-foreground font-normal">#{f.id}</span>}
                    </button>
                  </td>
                  <td className="text-muted-foreground px-3 py-1.5">{DIRECTION_LABEL[f.direction]}</td>
                  {onPeriodChange ? (
                    <PeriodCell f={f} onChange={onPeriodChange} />
                  ) : (
                    <td className="px-3 py-1.5 text-right">
                      {f.period} {f.periodUnit}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-right">{f.rateHz.toFixed(2)} Hz</td>
                  <td className="px-3 py-1.5 text-right">{f.payloadBytes} B</td>
                  <td className="px-3 py-1.5 text-right">{f.wireBytes} B</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{formatBitrate(f.wireBps)}</td>
                </tr>
                {isOpen && (
                  <tr className="bg-muted/30 border-b">
                    <td colSpan={7} className="p-3">
                      <FlowBreakdown f={f} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="tabular-nums">
          {directions.map((d, i) => (
            <tr key={d} className={cn("bg-muted/20", i === 0 && "border-t")}>
              <td colSpan={6} className="text-muted-foreground px-3 py-1.5">
                Total, {DIRECTION_LABEL[d].toLowerCase()}
              </td>
              <td className="px-3 py-1.5 text-right font-semibold">
                {formatBitrate(flows.filter((f) => f.direction === d).reduce((s, f) => s + f.wireBps, 0))}
              </td>
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}

// ─── stacked capacity bar ────────────────────────────────────────────────────

interface Segment {
  key: string;
  label: string;
  color: string;
  udp: number;
  keepAlive: number;
  highlight?: { offset: number; bps: number; label: string };
}

function StackedBar({ title, segments, capacityBps }: { title: string; segments: Segment[]; capacityBps: number }) {
  const total = segments.reduce((s, x) => s + x.udp + x.keepAlive, 0);
  const over = total > capacityBps;
  // Over capacity, scale to the total so every board still shows.
  const scale = Math.max(capacityBps, total);
  const visible = segments.filter((s) => s.udp + s.keepAlive > 0);
  const highlighted = segments.find((s) => s.highlight)?.highlight;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="ml-auto text-sm font-semibold tabular-nums">{formatBitrate(total)}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          of {formatBitrate(capacityBps).replace(/\.00 /, " ")}
        </span>
      </div>
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-md">
        {visible.map((s) => {
          const bps = s.udp + s.keepAlive;
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger asChild>
                <div className="flex h-full shrink-0" style={{ width: `${(bps / scale) * 100}%` }}>
                  {s.udp > 0 && (
                    <div className="relative h-full" style={{ flexGrow: s.udp }}>
                      <div className="absolute inset-0 transition-opacity" style={{ backgroundColor: s.color, opacity: highlighted ? 0.25 : 1 }} />
                      {s.highlight && (
                        <div
                          role="img"
                          aria-label={`${s.highlight.label}: ${formatBitrate(s.highlight.bps)}`}
                          className="absolute inset-y-0 z-10 ring-2 ring-inset ring-foreground"
                          style={{
                            left: `${(s.highlight.offset / s.udp) * 100}%`,
                            width: `${(s.highlight.bps / s.udp) * 100}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      )}
                    </div>
                  )}
                  {s.keepAlive > 0 && <div className="h-full transition-opacity" style={{ flexGrow: s.keepAlive, opacity: highlighted ? 0.25 : 1, ...keepAliveFill(s.color) }} />}
                </div>
              </TooltipTrigger>
              <TooltipContent className="tabular-nums">
                <div className="font-semibold">{s.label}</div>
                {s.udp > 0 && <div>UDP {formatBitrate(s.udp)}</div>}
                {s.keepAlive > 0 && <div>Keep-alive {formatBitrate(s.keepAlive)}</div>}
                <div>
                  {formatBitrate(bps)}, {pctOf(bps, capacityBps)} of the link
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {!over && <div className="bg-foreground/[0.07] h-full min-w-0 flex-1" />}
      </div>
      {highlighted && (
        <p aria-live="polite" className="mt-2 text-xs font-medium tabular-nums">
          {highlighted.label}: {formatBitrate(highlighted.bps)} · {pctOf(highlighted.bps, capacityBps)} of the link
        </p>
      )}
      <div className="mt-1 flex text-xs tabular-nums">
        {over ? (
          <span className="flex items-center gap-1 font-medium text-[#d03b3b]">
            <AlertTriangle className="size-3.5" />
            Exceeds the link by {formatBitrate(total - capacityBps)}
          </span>
        ) : (
          <>
            <span className="text-muted-foreground">{pctOf(total, capacityBps)} used</span>
            <span className="text-muted-foreground ml-auto">{formatBitrate(capacityBps - total)} free</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── scenario panel ──────────────────────────────────────────────────────────

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  disabled,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const invalid = !(Number(value) > 0);
  return (
    <label className={cn("flex items-center gap-2 text-xs", disabled && "opacity-50")}>
      <span className="text-muted-foreground min-w-0 flex-1">{label}</span>
      <StepperInput
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        onValueChange={onChange}
        className="h-7 w-[5.5rem] pl-2 text-right text-xs tabular-nums"
      />
      <span className="text-muted-foreground w-[2.75rem]">{unit}</span>
    </label>
  );
}

function Option({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="text-xs leading-snug">
        {label}
        <span className="text-muted-foreground block text-[11px]">{hint}</span>
      </span>
    </label>
  );
}

const CAPACITY_PRESETS = ["1", "10", "100", "1000"];

type View = "direction" | "combined";

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex overflow-hidden rounded-md border text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 py-1.5 transition-colors",
            value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── tab ─────────────────────────────────────────────────────────────────────

export function ThroughputTab({ boards }: { boards: BoardMeta[] }) {
  const [options, setOptions] = useState<TrafficOptions>(DEFAULT_TRAFFIC_OPTIONS);
  const [view, setView] = useState<View>("direction");
  const [capacityMbps, setCapacityMbps] = useState("100");
  const [backendMs, setBackendMs] = useState("50");
  const [boardMs, setBoardMs] = useState("50");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [periodOverrides, setPeriodOverrides] = useState<PeriodOverridesByBoard>({});
  const [selectedPacket, setSelectedPacket] = useState<{ board: string; key: string } | null>(null);

  const rows = useMemo(
    () =>
      boards.map((b) =>
        computeBoardThroughput(
          b,
          options.countAs,
          new Map(Object.entries(periodOverrides[b.name] ?? {}).map(([id, o]) => [Number(id), o])),
        ),
      ),
    [boards, options.countAs, periodOverrides],
  );
  const [connected, setConnected] = useState<Set<string>>(() => new Set(rows.filter((r) => r.hasTcp).map((r) => r.board)));

  const kaFlows = useMemo(
    () =>
      options.keepAlive
        ? keepAliveFlows({ backendMs: Number(backendMs) || 0, boardMs: Number(boardMs) || 0 }, options)
        : [],
    [options, backendMs, boardMs],
  );

  const totals = new Map<string, BoardTotals>(
    rows.map((r) => [r.board, boardTotals(r, connected.has(r.board), kaFlows, options.udp)]),
  );
  const sum = (pick: (t: BoardTotals) => number) => rows.reduce((s, r) => s + pick(totals.get(r.board)!), 0);

  const capacityBps = Number(capacityMbps) > 0 ? Number(capacityMbps) * 1e6 : null;

  const modifiedCount = (board: string) => Object.keys(periodOverrides[board] ?? {}).length;
  const totalModified = Object.values(periodOverrides).reduce((s, m) => s + Object.keys(m).length, 0);

  // A period equal to the ADJ's (in any unit, e.g. 10 ms = 10000 us) or a
  // reset drops the override entirely.
  const setPeriod = (board: string, f: TrafficFlow, override: PeriodOverride | null) =>
    setPeriodOverrides((prev) => {
      const forBoard = { ...prev[board] };
      const adjSeconds = periodSeconds(f.adjPeriod ?? f.period, f.adjPeriodUnit ?? f.periodUnit);
      const newSeconds = override && periodSeconds(override.value, override.unit);
      const sameAsAdj =
        adjSeconds !== undefined && newSeconds != null && Math.abs(newSeconds - adjSeconds) <= adjSeconds * 1e-9;
      if (override === null || sameAsAdj) delete forBoard[f.id!];
      else forBoard[f.id!] = override;
      const next = { ...prev };
      if (Object.keys(forBoard).length > 0) next[board] = forBoard;
      else delete next[board];
      return next;
    });

  const segmentsFor = (udp: (t: BoardTotals) => number, keepAlive: (t: BoardTotals) => number): Segment[] => {
    const segments: Segment[] = [];
    const other: Segment = { key: "__other", label: "Other boards", color: seriesColor(SERIES_SLOTS), udp: 0, keepAlive: 0 };
    rows.forEach((r, i) => {
      const t = totals.get(r.board)!;
      const packetIndex = selectedPacket?.board === r.board
        ? r.packets.findIndex((p) => p.key === selectedPacket.key)
        : -1;
      const packet = r.packets[packetIndex];
      const highlight = packet && udp(t) > 0 ? {
        offset: r.packets.slice(0, packetIndex).reduce((s, p) => s + p.wireBps, 0),
        bps: packet.wireBps,
        label: `${r.board} / ${packet.name} #${packet.id}`,
      } : undefined;
      if (i < SERIES_SLOTS) {
        segments.push({ key: r.board, label: r.board, color: seriesColor(i), udp: udp(t), keepAlive: keepAlive(t), highlight });
      } else {
        if (highlight) other.highlight = { ...highlight, offset: other.udp + highlight.offset };
        other.udp += udp(t);
        other.keepAlive += keepAlive(t);
      }
    });
    if (other.udp + other.keepAlive > 0) segments.push(other);
    return segments;
  };

  const linkUse = (t: BoardTotals) => (view === "direction" ? t.up : t.up + t.down);

  const setOption = (key: "udp" | "keepAlive" | "acks") => (v: boolean) => setOptions((o) => ({ ...o, [key]: v }));
  const setCountAs = (countAs: CountAs) => setOptions((o) => ({ ...o, countAs }));
  const toggleConnected = (board: string, v: boolean) =>
    setConnected((s) => {
      const n = new Set(s);
      if (v) n.add(board);
      else n.delete(board);
      return n;
    });

  return (
    <TooltipProvider>
      {/* items-start keeps the scenario panel at its own height; sticky keeps it
          in view while the page scrolls through expanded boards. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Scenario */}
        <aside className="bg-muted/20 grid shrink-0 gap-6 rounded-lg border p-4 sm:grid-cols-2 lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:w-[18rem] lg:flex-col lg:overflow-y-auto">
          <ThroughputHelp backendMs={Number(backendMs) || 0} boardMs={Number(boardMs) || 0} />

          <Group title="Link">
            <NumberField label="Capacity" unit="Mbit/s" value={capacityMbps} onChange={setCapacityMbps} />
            <div className="flex gap-1">
              {CAPACITY_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCapacityMbps(p)}
                  className={cn(
                    "flex-1 rounded-md border py-1 text-[11px] tabular-nums transition-colors",
                    capacityMbps === p
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {Number(p) >= 1000 ? `${Number(p) / 1000} G` : `${p} M`}
                </button>
              ))}
            </div>
          </Group>

          <Group title="View">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                ["direction", "Per direction"],
                ["combined", "Both ways"],
              ]}
            />
          </Group>

          <Group title="Count bytes as">
            <Segmented
              value={options.countAs}
              onChange={setCountAs}
              options={[
                ["wire", "On the wire"],
                ["wireshark", "Wireshark"],
              ]}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              {options.countAs === "wire"
                ? "Everything that occupies the link: preamble, the frame with its FCS, and the inter-frame gap."
                : "Frame length as a capture on the backend shows it: no preamble, gap or FCS, and frames the backend sends aren't padded yet."}
            </p>
          </Group>

          <Group title="Keep-alive interval">
            <NumberField
              label="Backend → boards"
              unit="ms"
              value={backendMs}
              onChange={setBackendMs}
              disabled={!options.keepAlive}
            />
            <NumberField
              label="Boards → backend"
              unit="ms"
              value={boardMs}
              onChange={setBoardMs}
              disabled={!options.keepAlive}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              Only boards ticked as TCP connected exchange keep-alives, like the{" "}
              <code className="text-foreground">[vehicle] boards</code> list in the backend config.
            </p>
          </Group>

          <Group title="Include in the estimate">
            <div className="space-y-2.5">
              <Option
                label="UDP data packets"
                hint="Periodic packets sent on a UDP socket"
                checked={options.udp}
                onChange={setOption("udp")}
              />
              <Option
                label="TCP keep-alive"
                hint="Empty packet with ID 1, in both directions"
                checked={options.keepAlive}
                onChange={setOption("keepAlive")}
              />
              <Option
                label="Separate TCP ACKs"
                hint="Worst case: one pure ACK per keep-alive"
                checked={options.acks}
                onChange={setOption("acks")}
              />
            </div>
            <p className="text-muted-foreground text-[11px] leading-snug">
              Assumes IPv4 and TCP without options, and Ethernet II without a VLAN tag.
            </p>
          </Group>

          {totalModified > 0 && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setPeriodOverrides({})}>
              Reset {totalModified} edited period{totalModified === 1 ? "" : "s"}
            </Button>
          )}
        </aside>

        {/* Results */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="space-y-5">
            {options.countAs === "wireshark" && (
              <p className="text-muted-foreground text-xs">
                Counting bytes as Wireshark shows them. The link itself carries more: preamble, inter-frame gap and FCS,
                and padding on frames the backend sends.
              </p>
            )}
            {capacityBps === null ? (
              <p className="text-muted-foreground text-sm">Set a link capacity above 0 to draw the bars.</p>
            ) : view === "direction" ? (
              <>
                <StackedBar
                  title="Boards → backend"
                  segments={segmentsFor((t) => t.udp, (t) => t.keepAliveUp)}
                  capacityBps={capacityBps}
                />
                <StackedBar
                  title="Backend → boards"
                  segments={segmentsFor(() => 0, (t) => t.keepAliveDown)}
                  capacityBps={capacityBps}
                />
              </>
            ) : (
              <StackedBar
                title="Both directions"
                segments={segmentsFor((t) => t.udp, (t) => t.keepAliveUp + t.keepAliveDown)}
                capacityBps={capacityBps}
              />
            )}
            {selectedPacket && options.udp && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedPacket(null)}>
                Clear packet highlight
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              {rows.map((r, i) => (
                <span key={r.board} className="flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-[3px]" style={{ backgroundColor: seriesColor(i) }} />
                  {r.board}
                </span>
              ))}
              <span className="text-muted-foreground ml-auto flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="bg-foreground/60 inline-block h-3 w-5 rounded-[3px]" />
                  UDP
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-5 rounded-[3px]"
                    style={keepAliveFill("color-mix(in oklab, var(--foreground) 60%, transparent)")}
                  />
                  TCP keep-alive
                </span>
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Board</th>
                  <th className="px-3 py-2 text-left font-medium" title="The backend opens TCP (and keep-alive) to this board">
                    TCP connected
                  </th>
                  <th className="px-3 py-2 text-right font-medium">UDP</th>
                  <th className="px-3 py-2 text-right font-medium">To backend</th>
                  <th className="px-3 py-2 text-right font-medium">From backend</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {view === "direction" ? "Link use, to backend" : "Link use, both ways"}
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r, i) => {
                  const t = totals.get(r.board)!;
                  const isOpen = expanded === r.board;
                  const edited = modifiedCount(r.board);
                  return (
                    <Fragment key={r.board}>
                      <tr className={cn("border-b", isOpen && "bg-muted/30")}>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => { setExpanded(isOpen ? null : r.board); setSelectedPacket(null); }}
                            aria-expanded={isOpen}
                            className="flex items-center gap-2 text-left"
                          >
                            {isOpen ? (
                              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                            ) : (
                              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                            )}
                            <span className="inline-block size-3 shrink-0 rounded-[3px]" style={{ backgroundColor: seriesColor(i) }} />
                            <span className="font-semibold">{r.board}</span>
                          </button>
                          {(r.skipped.length > 0 || edited > 0) && (
                            <div className="ml-[2.75rem] mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                              {r.skipped.length > 0 && (
                                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                  <AlertTriangle className="size-3" />
                                  {r.skipped.length} packet{r.skipped.length === 1 ? "" : "s"} not counted
                                </span>
                              )}
                              {edited > 0 && (
                                <span className="text-primary">
                                  {edited} period{edited === 1 ? "" : "s"} edited
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={connected.has(r.board)}
                            disabled={!r.hasTcp}
                            title={r.hasTcp ? undefined : "No TCP socket in the ADJ"}
                            aria-label={`${r.board} TCP connected`}
                            onCheckedChange={(v) => toggleConnected(r.board, v === true)}
                          />
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-right">{formatBitrate(t.udp)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatBitrate(t.up)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatBitrate(t.down)}</td>
                        <td className="px-3 py-2 text-right">{pctOf(linkUse(t), capacityBps)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b">
                          <td colSpan={6} className="bg-muted/20 p-3">
                            <BoardDetail
                              board={r}
                              options={options}
                              connected={connected.has(r.board)}
                              kaFlows={kaFlows}
                              totals={t}
                              capacityBps={capacityBps}
                              onPeriodChange={(f, o) => setPeriod(r.board, f, o)}
                              selectedKey={selectedPacket?.board === r.board ? selectedPacket.key : undefined}
                              onSelectFlow={(f) => setSelectedPacket(f ? { board: r.board, key: f.key } : null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 tabular-nums">
                <tr>
                  <td colSpan={2} className="px-3 py-2 font-semibold">
                    All boards
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right">{formatBitrate(sum((t) => t.udp))}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatBitrate(sum((t) => t.up))}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatBitrate(sum((t) => t.down))}</td>
                  <td className="px-3 py-2 text-right font-semibold">{pctOf(sum(linkUse), capacityBps)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function BoardDetail({
  board,
  options,
  connected,
  kaFlows,
  totals,
  capacityBps,
  onPeriodChange,
  selectedKey,
  onSelectFlow,
}: {
  board: BoardThroughput;
  options: TrafficOptions;
  connected: boolean;
  kaFlows: TrafficFlow[];
  totals: BoardTotals;
  capacityBps: number | null;
  onPeriodChange: OnPeriodChange;
  selectedKey?: string;
  onSelectFlow: (flow: TrafficFlow | null) => void;
}) {
  const note = (text: string) => (
    <p className="text-muted-foreground bg-background rounded-md border px-3 py-2 text-xs">{text}</p>
  );

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs tabular-nums">
        <dt className="text-muted-foreground">To backend</dt>
        <dd>
          {formatBitrate(totals.udp)} UDP + {formatBitrate(totals.keepAliveUp)} keep-alive ={" "}
          <span className="font-semibold">{formatBitrate(totals.up)}</span>
          <span className="text-muted-foreground">, {pctOf(totals.up, capacityBps)} of the link</span>
        </dd>
        <dt className="text-muted-foreground">From backend</dt>
        <dd>
          {formatBitrate(totals.keepAliveDown)} keep-alive ={" "}
          <span className="font-semibold">{formatBitrate(totals.down)}</span>
          <span className="text-muted-foreground">, {pctOf(totals.down, capacityBps)} of the link</span>
        </dd>
      </dl>

      {!options.udp
        ? note("UDP data packets are left out of the estimate.")
        : board.packets.length > 0
          ? (
            <FlowTable
              title="UDP data packets"
              flows={[...board.packets].sort((a, b) => a.id! - b.id!)}
              onPeriodChange={onPeriodChange}
              selectedKey={selectedKey}
              onSelectFlow={onSelectFlow}
            />
          )
          : note("This board has no periodic UDP packets.")}

      {!options.keepAlive
        ? note("TCP keep-alive is left out of the estimate.")
        : !connected
          ? note("Not TCP connected, so no keep-alive traffic.")
          : kaFlows.length > 0
            ? (
              <FlowTable
                title={options.acks ? "TCP keep-alive, each segment acknowledged separately" : "TCP keep-alive, ACKs ride on the other side's keep-alive"}
                flows={kaFlows}
              />
            )
            : note("Both keep-alive intervals are off.")}

      {board.skipped.length > 0 && (
        <div className="bg-background space-y-1 rounded-md border px-3 py-2 text-xs">
          {board.skipped.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                (ID {s.id}) is not counted: {s.reason}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
