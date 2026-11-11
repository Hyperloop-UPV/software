import { useMemo } from "react";
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hyperloopupv/frontend-kit/components";
import { Settings2, X } from "@hyperloopupv/frontend-kit/icons";
import { summarizeWindow } from "../../lib/normal/statistics";
import type {
  ComparisonSignal,
  StatisticsColumn,
  TimeDomain,
  TimeRange,
} from "../../types/normal";
import { DEFAULT_STATISTICS_COLUMNS } from "../../types/normal";

const format = (value: number) =>
  value.toLocaleString(undefined, { maximumSignificantDigits: 6 });

export interface StatisticsGroup {
  id: string;
  label: string;
  range: TimeRange;
  signals: ComparisonSignal[];
}

const COLUMNS: { id: StatisticsColumn; label: string }[] = [
  { id: "samples", label: "Samples" },
  { id: "min", label: "Minimum" },
  { id: "max", label: "Maximum" },
  { id: "mean", label: "Average" },
  { id: "std", label: "Standard deviation" },
  { id: "firstLast", label: "First → last" },
  { id: "changes", label: "State changes" },
];

export default function WindowStatistics({
  groups,
  domain,
  onClose,
  columns,
  onColumnsChange,
}: {
  // One group while the time axis is linked; one per plot when it is not,
  // because then each plot summarises a different stretch of the recording.
  groups: StatisticsGroup[];
  domain: TimeDomain;
  onClose: () => void;
  columns?: StatisticsColumn[];
  onColumnsChange: (columns: StatisticsColumn[]) => void;
}) {
  // Existing saved dashboards predate this preference.
  const visibleColumns = columns ?? DEFAULT_STATISTICS_COLUMNS;
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

  const toggleColumn = (column: StatisticsColumn, checked: boolean) => {
    if (checked) {
      onColumnsChange(
        COLUMNS.filter(
          ({ id }) => visibleColumns.includes(id) || id === column,
        ).map(({ id }) => id),
      );
    } else if (visibleColumns.length > 1) {
      onColumnsChange(visibleColumns.filter((id) => id !== column));
    }
  };

  return (
    <section
      id="window-statistics"
      aria-label="Visible window statistics"
      className="border-border bg-background flex max-h-64 min-h-0 shrink-0 flex-col border-t"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-xs font-semibold">Window statistics</h2>
          <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
            {groups.length === 1
              ? `${groups[0].range.start.toFixed(1)}–${groups[0].range.end.toFixed(1)}% of recording`
              : "Per-plot windows"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <p className="text-muted-foreground hidden text-[10px] sm:block">
            Original values · Recorded samples only · Average is sample-weighted
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Customize statistics columns"
                title="Customize statistics columns"
              >
                <Settings2 className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-3">
              <p className="text-sm font-semibold">Visible metrics</p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Saved for this dashboard.
              </p>
              <div className="mt-3 grid gap-2">
                {COLUMNS.map(({ id, label }) => {
                  const checked = visibleColumns.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={checked && visibleColumns.length === 1}
                        onCheckedChange={(value) =>
                          toggleColumn(id, value === true)
                        }
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-1"
            onClick={onClose}
            aria-label="Close window statistics"
            title="Close statistics"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 overflow-auto px-4 pb-2">
        <table className="w-full text-right text-[11px] whitespace-nowrap tabular-nums">
          <thead className="bg-background text-muted-foreground sticky top-0">
            <tr>
              {[
                "Signal",
                "Unit",
                ...COLUMNS.filter(({ id }) => visibleColumns.includes(id)).map(
                  ({ label }) => label,
                ),
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
                    colSpan={visibleColumns.length + 2}
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
                    {stats ? (
                      <>
                        {visibleColumns.includes("samples") && (
                          <td className="px-3 py-2">
                            {stats.count.toLocaleString()}
                          </td>
                        )}
                        {visibleColumns.includes("min") && (
                          <td className="px-3 py-2">
                            {signal.discrete ? "—" : format(stats.min)}
                          </td>
                        )}
                        {visibleColumns.includes("max") && (
                          <td className="px-3 py-2">
                            {signal.discrete ? "—" : format(stats.max)}
                          </td>
                        )}
                        {visibleColumns.includes("mean") && (
                          <td className="px-3 py-2">
                            {signal.discrete ? "—" : format(stats.mean)}
                          </td>
                        )}
                        {visibleColumns.includes("std") && (
                          <td className="px-3 py-2">
                            {signal.discrete ? "—" : format(stats.std)}
                          </td>
                        )}
                        {visibleColumns.includes("firstLast") && (
                          <td className="px-3 py-2">
                            {state(stats.first)} → {state(stats.last)}
                          </td>
                        )}
                        {visibleColumns.includes("changes") && (
                          <td className="px-3 py-2">
                            {signal.discrete
                              ? stats.changes.toLocaleString()
                              : "—"}
                          </td>
                        )}
                      </>
                    ) : (
                      <td
                        colSpan={visibleColumns.length}
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
