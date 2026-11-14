import { lowerBound, upperBound } from "../plotStudio/range";
import {
  TIME_DIVISORS,
  type ComparisonSignal,
  type TimeDomain,
  type TimeRange,
  type TimeUnit,
} from "../../types/normal";

// Tables leave the app as delimited text: comma-separated for files, tab-
// separated for the clipboard, which spreadsheets split into cells on paste.

export type Cell = string | number | null | undefined;

const cellText = (cell: Cell) =>
  cell === null || cell === undefined
    ? ""
    : typeof cell === "number"
      ? Number.isFinite(cell)
        ? String(cell)
        : ""
      : cell;

export function toDelimited(rows: Cell[][], separator: "," | "\t"): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cellText(cell);
          return /["\n\r]/.test(text) || text.includes(separator)
            ? `"${text.replace(/"/g, '""')}"`
            : text;
        })
        .join(separator),
    )
    .join("\n");
}

export const toCsv = (rows: Cell[][]) => `${toDelimited(rows, ",")}\n`;
export const toTsv = (rows: Cell[][]) => toDelimited(rows, "\t");

/**
 * The recorded samples of each signal inside a window, one row per sample.
 * Long format on purpose: signals logged at different instants share no time
 * column, and aligning them would mean inventing values.
 */
export function visibleDataRows(
  signals: ComparisonSignal[],
  domain: TimeDomain,
  range: TimeRange,
  timeUnit: TimeUnit,
): Cell[][] {
  const duration = domain.endMs - domain.startMs;
  const from = domain.startMs + (duration * range.start) / 100;
  const to = domain.startMs + (duration * range.end) / 100;
  const divisor = TIME_DIVISORS[timeUnit];
  const rows: Cell[][] = [
    ["Board", "Signal", "Unit", `Time (${timeUnit})`, "Value"],
  ];
  for (const signal of signals) {
    const { time, value } = signal.data;
    const unit = signal.discrete ? "State" : (signal.units ?? "");
    for (let i = lowerBound(time, from); i < upperBound(time, to); i++) {
      const raw = value[i];
      rows.push([
        signal.board,
        signal.name,
        unit,
        (time[i] - domain.startMs) / divisor,
        signal.discrete ? (signal.enumLabels?.[Math.round(raw)] ?? raw) : raw,
      ]);
    }
  }
  return rows;
}
