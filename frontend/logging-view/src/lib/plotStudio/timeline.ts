// Support for the "Cronograma" plot mode: renders enum/boolean signals as a
// Gantt-style state timeline instead of a line chart. See units.ts for the
// ADJ-metadata-based type lookup — this file covers the data-driven fallback
// (for plain CSV signals with no type metadata) and the segment computation
// shared by both.
import type { SeriesData } from "../../types/plotStudio";

export interface StateSegment {
  start: number;
  end: number;
  value: number;
}

// Heuristic eligibility check for signals with no ADJ type metadata: a
// genuinely continuous signal has (almost) as many distinct values as
// samples, while an enum/boolean one repeats a small handful of codes.
// Sampled rather than scanning the full array — this only needs to answer
// "few states or not," not compute anything exact.
export function isDiscreteSeries(data: SeriesData, maxUnique = 12): boolean {
  const { value } = data;
  const n = value.length;
  if (n === 0) return false;

  const sampleSize = Math.min(n, 5000);
  const step = Math.max(1, Math.floor(n / sampleSize));
  const unique = new Set<number>();
  for (let i = 0; i < n; i += step) {
    unique.add(value[i]);
    if (unique.size > maxUnique) return false;
  }
  return unique.size < sampleSize;
}

// Single pass over (time, value): emits one segment per contiguous run of
// the same value, mirroring the single-pass style used in stats.ts.
//
// `endMs` is when the recording ends. The final run holds until then, which
// matters whenever the last state change is the last sample of this series:
// closing that run at its own last sample would give it zero duration and
// draw it as a 1px sliver, reading as "that state never happened". Callers
// pass the end of the whole plot/recording; omitting it keeps the old
// self-closing behaviour.
export function computeStateSegments(
  data: SeriesData,
  endMs?: number,
): StateSegment[] {
  const { time, value } = data;
  const n = time.length;
  if (n === 0) return [];

  const segments: StateSegment[] = [];
  let start = time[0];
  let current = value[0];
  for (let i = 1; i < n; i++) {
    if (value[i] !== current) {
      segments.push({ start, end: time[i], value: current });
      start = time[i];
      current = value[i];
    }
  }
  segments.push({
    start,
    end: Math.max(time[n - 1], endMs ?? time[n - 1]),
    value: current,
  });
  return segments;
}

// Human-readable label for a state code: enum name if available, True/False
// for boolean-looking 0/1, otherwise a generic "State N" fallback.
export function stateLabel(
  value: number,
  enumLabels: string[] | undefined,
): string {
  if (
    enumLabels &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < enumLabels.length
  ) {
    return enumLabels[value];
  }
  if (value === 0 || value === 1) return value === 1 ? "True" : "False";
  return `State ${value}`;
}
