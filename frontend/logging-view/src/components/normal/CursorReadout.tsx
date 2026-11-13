import { useMemo } from "react";
import { Button } from "@hyperloopupv/frontend-kit/components";
import { X } from "@hyperloopupv/frontend-kit/icons";
import { valueAt } from "../../lib/normal/cursors";
import {
  TIME_DIVISORS,
  type ComparisonSignal,
  type MeasureCursors,
  type TimeDomain,
  type TimeUnit,
} from "../../types/normal";

const format = (value: number) =>
  value.toLocaleString(undefined, { maximumSignificantDigits: 6 });

const dash = "—";

export default function CursorReadout({
  cursors,
  signals,
  domain,
  timeUnit,
  onClear,
  onClose,
}: {
  cursors: MeasureCursors;
  signals: ComparisonSignal[];
  domain: TimeDomain;
  timeUnit: TimeUnit;
  onClear: () => void;
  onClose: () => void;
}) {
  const { a, b } = cursors;
  const rows = useMemo(
    () =>
      signals.map((signal) => {
        const at = (cursor: number | null) =>
          cursor === null
            ? null
            : valueAt(signal.data, domain.startMs + cursor, signal.discrete);
        return { signal, atA: at(a), atB: at(b) };
      }),
    [signals, domain.startMs, a, b],
  );
  const time = (cursor: number | null) =>
    cursor === null ? dash : format(cursor / TIME_DIVISORS[timeUnit]);
  const deltaMs = a !== null && b !== null ? b - a : null;
  const deltaTime = deltaMs === null ? null : deltaMs / TIME_DIVISORS[timeUnit];

  return (
    <section
      id="cursor-readout"
      aria-label="Cursor measurements"
      className="border-border bg-background flex max-h-56 min-h-0 shrink-0 flex-col border-t"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="text-xs font-semibold">Cursors</h2>
          {a === null && b === null ? (
            <span className="text-muted-foreground text-[11px]">
              Click a plot to place A · Shift+click to place B
            </span>
          ) : (
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
              {(
                [
                  ["A", `${time(a)} ${timeUnit}`],
                  ["B", `${time(b)} ${timeUnit}`],
                  [
                    "Δt",
                    deltaTime === null
                      ? dash
                      : `${format(deltaTime)} ${timeUnit}`,
                  ],
                  [
                    "1/Δt",
                    deltaMs ? `${format(1000 / Math.abs(deltaMs))} Hz` : dash,
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <dt className="text-muted-foreground font-sans">{label}</dt>
                  <dd aria-label={`Cursor ${label}`}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            disabled={a === null && b === null}
            onClick={onClear}
          >
            Clear cursors
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label="Close cursor measurements"
            title="Close cursors"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      {rows.length > 0 && (a !== null || b !== null) && (
        <div className="min-h-0 overflow-auto px-4 pb-2">
          <table className="w-full text-right text-[11px] whitespace-nowrap tabular-nums">
            <thead className="bg-background text-muted-foreground sticky top-0">
              <tr>
                {[
                  "Signal",
                  "Unit",
                  "At A",
                  "At B",
                  "Δ (B − A)",
                  `Δ / ${timeUnit}`,
                ].map((label, index) => (
                  <th
                    key={label}
                    scope="col"
                    className={`px-3 py-2 font-medium ${index === 0 ? "pl-0 text-left" : ""}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ signal, atA, atB }) => {
                const shown = (value: number | null) =>
                  value === null
                    ? dash
                    : signal.discrete
                      ? (signal.enumLabels?.[Math.round(value)] ??
                        format(value))
                      : format(value);
                const delta =
                  atA !== null && atB !== null && !signal.discrete
                    ? atB - atA
                    : null;
                return (
                  <tr
                    key={signal.id}
                    className="border-border/50 hover:bg-muted/30 border-t"
                  >
                    <th
                      scope="row"
                      className="max-w-[18rem] truncate py-1.5 pr-3 text-left font-normal"
                    >
                      <span
                        className="mr-2 inline-block size-2 rounded-full"
                        style={{ backgroundColor: signal.color }}
                      />
                      {signal.board} / {signal.name}
                    </th>
                    <td className="text-muted-foreground px-3 py-1.5">
                      {signal.discrete ? dash : signal.units || dash}
                    </td>
                    <td className="px-3 py-1.5">{shown(atA)}</td>
                    <td className="px-3 py-1.5">{shown(atB)}</td>
                    <td className="px-3 py-1.5">
                      {delta === null ? dash : format(delta)}
                    </td>
                    <td className="px-3 py-1.5">
                      {delta === null || !deltaTime
                        ? dash
                        : format(delta / deltaTime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
