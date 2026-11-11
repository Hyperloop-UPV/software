import { useMemo } from "react";
import { summarizeWindow } from "../../lib/normal/statistics";
import type {
  ComparisonSignal,
  TimeDomain,
  TimeRange,
} from "../../types/normal";

const format = (value: number) =>
  value.toLocaleString(undefined, { maximumSignificantDigits: 6 });

export interface StatisticsGroup {
  id: string;
  label: string;
  range: TimeRange;
  signals: ComparisonSignal[];
}

export default function WindowStatistics({
  groups,
  domain,
}: {
  // One group while the time axis is linked; one per plot when it is not,
  // because then each plot summarises a different stretch of the recording.
  groups: StatisticsGroup[];
  domain: TimeDomain;
}) {
  const sections = useMemo(() => {
    const duration = domain.endMs - domain.startMs;
    return groups.map((group) => {
      const start = domain.startMs + (duration * group.range.start) / 100;
      const end = domain.startMs + (duration * group.range.end) / 100;
      return {
        ...group,
        rows: group.signals.map((signal) => ({
          signal,
          stats: summarizeWindow(signal.data, start, end),
        })),
      };
    });
  }, [groups, domain]);

  return (
    <section
      id="window-statistics"
      aria-label="Visible window statistics"
      className="border-border bg-background flex max-h-64 min-h-0 shrink-0 flex-col border-t"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 px-4 py-2">
        <h2 className="text-xs font-semibold">Window statistics</h2>
        <p className="text-muted-foreground text-[10px]">
          Original values · Recorded samples only · Average is sample-weighted
        </p>
      </div>
      <div className="min-h-0 overflow-auto px-4 pb-2">
        <table className="w-full text-right text-[11px] whitespace-nowrap tabular-nums">
          <thead className="bg-background text-muted-foreground sticky top-0">
            <tr>
              {[
                "Signal",
                "Unit",
                "Samples",
                "Min",
                "Max",
                "Average",
                "Std dev",
                "First → last",
                "Changes",
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
          {sections.map((section) => (
            <tbody key={section.id}>
              {sections.length > 1 && (
                <tr className="border-border border-t">
                  <th
                    scope="colgroup"
                    colSpan={9}
                    className="text-muted-foreground bg-muted/30 px-0 py-1.5 text-left text-[10px] font-semibold"
                  >
                    {section.label}
                    <span className="ml-2 font-mono font-normal tabular-nums">
                      {section.range.start.toFixed(1)}–
                      {section.range.end.toFixed(1)}%
                    </span>
                  </th>
                </tr>
              )}
              {section.rows.map(({ signal, stats }) => {
                const state = (value: number) =>
                  signal.discrete
                    ? (signal.enumLabels?.[value] ?? format(value))
                    : format(value);
                return (
                  <tr
                    key={`${section.id}:${signal.id}`}
                    className="border-border/50 hover:bg-muted/30 border-t"
                  >
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <span
                        className="inline-flex items-center gap-2"
                        title={`${signal.board} / ${signal.name}`}
                      >
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: signal.color }}
                        />
                        <span className="max-w-56 truncate">
                          <span className="text-muted-foreground">
                            {signal.board} /{" "}
                          </span>
                          {signal.name}
                        </span>
                      </span>
                    </th>
                    <td className="text-muted-foreground px-3 py-2">
                      {signal.discrete ? "State" : signal.units || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {(stats?.count ?? 0).toLocaleString()}
                    </td>
                    {stats ? (
                      <>
                        <td className="px-3 py-2">
                          {signal.discrete ? "—" : format(stats.min)}
                        </td>
                        <td className="px-3 py-2">
                          {signal.discrete ? "—" : format(stats.max)}
                        </td>
                        <td className="px-3 py-2">
                          {signal.discrete ? "—" : format(stats.mean)}
                        </td>
                        <td className="px-3 py-2">
                          {signal.discrete ? "—" : format(stats.std)}
                        </td>
                        <td className="px-3 py-2">
                          {state(stats.first)} → {state(stats.last)}
                        </td>
                        <td className="px-3 py-2">
                          {signal.discrete
                            ? stats.changes.toLocaleString()
                            : "—"}
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan={6}
                        className="text-muted-foreground px-3 py-2 text-left"
                      >
                        No samples in this window
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
